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

//发出第一个fiber, root fiber
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

let nextUnitofWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = null;

//commit阶段
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  const parentDOM = fiber.parent.dom;
  if (fiber.effectTag === "PLACEMENT" && fiber.dom) {
    parentDOM.append(fiber.dom);
  } else if (fiber.effectTag === "DELETION" && fiber.dom) {
    parentDOM.removeChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom) {
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function updateDOM(dom, prevProps, nextProps) {
  //删除已经没有的或者发生变化的事件处理函数
  Object.keys(prevProps)
    .filter((key) => key.startsWith("on"))
    .filter((key) => !(key in nextProps) || prevProps[key] !== nextProps[key])
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[key]);
    });

  //添加事件处理函数
  Object.keys(nextProps)
    .filter((key) => key.startsWith("on"))
    .filter((key) => prevProps[key] !== nextProps[key])
    .forEach((key) => {
      const eventType = key.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[key]);
    });

  //删除已经没有的props
  Object.keys(prevProps)
    .filter((key) => key !== "children")
    .filter((key) => !(key in nextProps))
    .forEach((key) => (dom[key] = ""));

  //赋予新的或者改变的props
  Object.keys(nextProps)
    .filter((key) => key !== "children")
    .filter((key) => !(key in prevProps) || prevProps[key] !== nextProps[key])
    .forEach((key) => {
      dom[key] = nextProps[key];
    });
}

// 调度函数
function workLoop(deadline) {
  // 应该退出
  let shouldYield = false;
  // 有工作且不应该退出
  while (nextUnitofWork && !shouldYield) {
    // 做工作
    nextUnitofWork = performUnitOfWork(nextUnitofWork);
    // 看看还有没有足够的时间
    shouldYield = deadline.timeRemaining() < 1;
  }

  // 没有足够的时间，请求下一次浏览器空闲的时候执行
  requestIdleCallback(workLoop);

  //commit阶段
  if (!nextUnitofWork && wipRoot) {
    commitRoot();
  }
}

// 第一次请求
requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  //创建DOM元素
  if (!fiber.dom) {
    fiber.dom = createDOM(fiber);
  }

  //给children新建fiber
  const elements = fiber.props.children;
  //新建newFiber，构建fiber
  reconcileChildren(fiber, elements);

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

export default render;
