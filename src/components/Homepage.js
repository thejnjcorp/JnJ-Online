import React from "react";
import { signInWithGooglePopup } from "../utils/firebase";
import logo from '../logo.svg';

export function Homepage({accountInfo, setAccountInfo}) {
  const logGoogleUser = async() => {
    const response = await signInWithGooglePopup();
    console.log(response)
    setAccountInfo(response)
  }

  document.title="Home"
  return <div>
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
      <br/>
      <button onClick={logGoogleUser}>Sign In With Google</button>
  </div>
}