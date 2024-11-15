import React from "react";
import logo from '../logo.svg';
import appData from './AppData.json';
import { updateGoogleSheetCells, getGoogleSheetCellsTargeted } from "./googleSheetCellFunctions";

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
              if (typeof res.result === 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })}>
            Put 'hi' and 'there' into cells C1 and C2
          </button>
          <button onClick={() => {
            getGoogleSheetCellsTargeted(appData.spreadSheetKey, 'Sheet1', ['B1', 'C2'])
            .then((res) => console.log(res))
            .catch(res => {
              if (typeof res.result === 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })
          }}>
            Get cells B1 and C2
          </button>
        </div>
}

export { Homepage }