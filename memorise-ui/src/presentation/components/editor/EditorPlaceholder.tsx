import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EditorPlaceholder: React.FC<any> = (props) => (
  <span
    {...props.attributes}
    style={{
      position: "absolute",
      pointerEvents: "none",
      opacity: 0.55,
      color: "#5A6A7A",
      fontFamily: "DM Mono, monospace",
    }}
  >
    {props.children}
  </span>
);


