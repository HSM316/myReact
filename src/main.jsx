import { render, useEffect, useState } from ".";

const Counter = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
    console.log("effect run, count =", count);
    return () => {
      console.log("cleanup, count was =", count);
    };
  }, [count]);

  return (
    <div>
      <h1 onclick={() => setCount((c) => c + 1)}>{count}</h1>
      <p>Click the number to increment (useState + useEffect)</p>
    </div>
  );
};

const container = document.querySelector("#root");
render(<Counter />, container);

