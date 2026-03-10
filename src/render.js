let nextUnitofWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = null;

// =========================
// 入口：发起一次渲染（创建 root fiber）
// =========================
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    sibling: null,
    child: null,
    parent: null,
    alternate: currentRoot,
  };

  deletions = [];
  nextUnitofWork = wipRoot;
}

// =========================
// 调度：浏览器空闲时分片执行（可中断）
// =========================
function workLoop(deadline) {
  //应该退出
  let shouldYield = false;
  //有工作且不应该退出
  while (nextUnitofWork && !shouldYield) {
    //做工作
    nextUnitofWork = performUnitOfWork(nextUnitofWork);
    //看看还有没有足够的时间
    shouldYield = deadline.timeRemaining() < 1;
  }

  //没有足够的时间，请求下一次浏览器空闲的时候执行
  requestIdleCallback(workLoop);

  //commit阶段
  if (!nextUnitofWork && wipRoot) {
    commitRoot();
  }
}

//第一次请求
requestIdleCallback(workLoop);

// =========================
// 构建：以 Fiber 为单位递进
// =========================
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  //返回下一个fiber
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

// 处理非函数式组件
function updateHostComponent(fiber) {
  //创建DOM元素
  if (!fiber.dom) {
    fiber.dom = createDOM(fiber);
  }
  //给children新建fiber
  const elements = fiber.props.children;
  //新建newFiber，构建fiber
  reconcileChildren(fiber, elements);
}

let wipFiber = null;
let hookIndex = null;

// 处理函数式组件（并驱动 Hooks 记录顺序）
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

// =========================
// Hooks：在函数组件渲染期间收集
// =========================
export function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = action(hook.state);
  });

  const setState = (action) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };

    nextUnitofWork = wipRoot;
    deletions = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex += 1;
  return [hook.state, setState];
}

export function useEffect(effect, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hasNoDeps = deps === undefined;
  const depsChanged =
    hasNoDeps ||
    !oldHook ||
    !oldHook.deps ||
    deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));

  const hook = {
    tag: "effect",
    deps,
    effect,
    cleanup: oldHook && oldHook.cleanup,
    hasChanged: depsChanged,
  };

  wipFiber.hooks.push(hook);
  hookIndex += 1;
}

// =========================
// 协调：对比新旧 children，生成 effectTag
// =========================
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber) {
    const element = elements[index];
    const sameType = element && oldFiber && element.type === oldFiber.type;
    let newFiber = null;

    if (sameType) {
      //更新
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }

    if (element && !sameType) {
      //新建
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }

    if (oldFiber && !sameType) {
      //删除
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    //如果是第一个，你就是亲儿子，否则就是兄弟
    if (index === 0) {
      wipFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    index += 1;
  }
}

// =========================
// 提交：把 effectTag 变成真实 DOM 操作
// =========================
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
  commitEffects(currentRoot.child);
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const parentDOM = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom) {
    parentDOM.append(fiber.dom);
  } else if (fiber.effectTag === "DELETION" && fiber.dom) {
    commitDeletion(fiber, parentDOM);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom) {
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

// =========================
// 副作用：commit 完成后执行 useEffect（含 cleanup）
// =========================
function commitEffects(fiber) {
  if (!fiber) return;

  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent && fiber.hooks) {
    fiber.hooks.forEach((hook) => {
      if (hook && hook.tag === "effect" && hook.hasChanged) {
        if (typeof hook.cleanup === "function") {
          hook.cleanup();
        }
        const cleanup = hook.effect();
        hook.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      }
    });
  }

  commitEffects(fiber.child);
  commitEffects(fiber.sibling);
}

// =========================
// DOM：创建与属性/事件更新
// =========================
function createDOM(fiber) {
  //创建元素
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  //赋予属性
  Object.keys(fiber.props)
    .filter((key) => key !== "children")
    .forEach((key) => (dom[key] = fiber.props[key]));

  return dom;
}

function updateDOM(dom, prevProps, nextProps) {
  const isEvent = (key) => key.startsWith("on");
  //删除已经没有的props
  Object.keys(prevProps)
    .filter((key) => key !== "children" && !isEvent(key))
    .filter((key) => !(key in nextProps))
    .forEach((key) => (dom[key] = ""));

  //赋予新的或者改变的props
  Object.keys(nextProps)
    .filter((key) => key !== "children" && !isEvent(key))
    .filter((key) => !(key in prevProps) || prevProps[key] !== nextProps[key])
    .forEach((key) => {
      dom[key] = nextProps[key];
    });

  //删除已经没有的或者发生变化的事件处理函数
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || prevProps[key] !== nextProps[key])
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[key]);
    });

  //添加事件处理函数
  Object.keys(nextProps)
    .filter(isEvent)
    .filter((key) => prevProps[key] !== nextProps[key])
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[key]);
    });
}

export default render;
