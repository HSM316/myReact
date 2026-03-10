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
  };

  nextUnitofWork = wipRoot;
}

let nextUnitofWork = null;
let wipRoot = null;

//commit阶段
function commitRoot() {
  commitWork(wipRoot.child);
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  const parentDOM = fiber.parent.dom;
  parentDOM.append(fiber.dom);
  commitWork(fiber.child);
  commitWork(fiber.sibling);
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
  let prevSibling = null;

  //建立fiber之间的联系，构建Fiber Tree
  for (let i = 0; i < elements.length; i += 1) {
    const newFiber = {
      type: elements[i].type,
      props: elements[i].props,
      parent: fiber,
      dom: null,
      child: null,
      sibling: null,
    };

    //如果是第一个，你就是亲儿子，否则就是兄弟
    if (i === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
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

export default render;
