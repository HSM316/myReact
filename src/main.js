import { createElement, render } from ".";
import { useState } from "./render";

const Counter = () => {
  const [state, setState] = useState(0);
  return createElement("h1", { onclick: () => setState((c) => c + 1) }, state);
};

const container = document.querySelector("#root");
const element = createElement(Counter);
render(element, container);
