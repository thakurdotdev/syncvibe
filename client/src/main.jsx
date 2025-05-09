import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

if (process.env.NODE_ENV === "live") {
  const script = document.createElement("script");
  script.src = "https://cloud.umami.is/script.js";
  script.defer = true;
  script.setAttribute(
    "data-website-id",
    "be07d2ea-3b87-4a58-9737-4b124635f28f",
  );
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
