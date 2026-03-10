function render(element, container) {
  //创建元素
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  //赋予属性
  Object.keys(element.props)
    .filter((key) => key !== "children")
    .forEach((key) => (dom[key] = element.props[key]));

  //追加到父节点
  container.append(dom);
}
let nextUnitofWork = null;

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
}

// 第一次请求
requestIdleCallback(workLoop);

function performUnitOfWork(work) {}

export default render;
