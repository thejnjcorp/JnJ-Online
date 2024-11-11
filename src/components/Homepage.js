import React from "react";
import logo from '../logo.svg';
import appData from './AppData.json';
import { updateGoogleSheetCells } from "./googleSheetCellFunctions";

function Homepage({setValidAccessToken, setErrorMessage, accessToken}) {
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
            <button onClick={() => 
            updateGoogleSheetCells(appData.spreadSheetKey, 'Sheet1', 'C1', 'C2', [['hi'], ['there']], accessToken)
            .catch(res => {
            setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })}>
            Put 'hi' and 'there' into cells C1 and C2
          </button>
        </div>
}

export { Homepage }