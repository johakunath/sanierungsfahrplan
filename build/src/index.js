import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// React & ReactDOM werden via externals aus window geholt (UMD inline im HTML)
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
