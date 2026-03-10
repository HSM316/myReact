import { createElement, render } from ".";

const handleInput = (e) => {
  renderer(e.target.value);
};

const renderer = (value) => {
  const container = document.querySelector("#root");
  const element = createElement(
    "div",
    null,
    createElement("input", { oninput: (e) => handleInput(e) }, null),
    createElement("h1", null, value),
  );
  render(element, container);
};

renderer();
