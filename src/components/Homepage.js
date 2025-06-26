import React from "react";
import logo from '../logo.svg';
import { useState } from "react";
import { uploadImageToImgur } from "../utils/imgurUploader";

export function Homepage() {
  const [file, setFile] = useState();
    const onFileChange = (event) => {
        setFile(event.target.files[0]);
    };

  document.title="Home"
  return <div>
      <input
        name="file"
        type="file"
        onChange={onFileChange}
      />
      <button onClick={() => uploadImageToImgur(file)}>Upload</button>
      <img src={logo} className="App-logo" alt="logo" />  
      <p>
      This is the homepage. More may be added here later.
      </p>
      <a
      className="App-link"
      href="https://reactjs.org"
      target="_blank"
      rel="noopener noreferrer"
      >
      Powered by React
      </a>
  </div>
}