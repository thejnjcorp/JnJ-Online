import React from "react";
import logo from '../logo.svg';
import appData from './AppData.json';
import { updateGoogleSheetCells, getGoogleSheetCellsTargeted } from "./googleSheetCellFunctions";
import { createJSONFile, getJSONFile, listFiles, updateJSONFile } from "./googleDriveFunctions";

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
            updateGoogleSheetCells(appData.spreadSheetKey, 'Sheet1', 'D1', 'D2', [['hi'], ['there']], accessToken)
            .catch(res => {
              if (typeof res.result != 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })}>
            Put 'hi' and 'there' into cells D1 and D2
          </button>
          <button onClick={() => {
            getGoogleSheetCellsTargeted(appData.spreadSheetKey, 'Sheet1', ['B1', 'C2'])
            .then((res) => console.log(res))
            .catch(res => {
              if (typeof res.result != 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })
          }}>
            Get cells B1 and C2
          </button>
          <button onClick={() => {
            const json = {
              "something": "else",
              "is": "going"
            }
            createJSONFile(json, accessToken, 'test.json')
          }}>
            Upload test JSON
          </button>
          <button onClick={() => {
            const json = {
              "something": "else",
              "is": "going",
              "on": "right"  
            }
            updateJSONFile(json, accessToken, 'test.json', '12VPnAH9O0tzXBqWwHIDCDAiIxThP0M7d')
          }}>
            update file hopefully
          </button>
          <button onClick={() => {
            getJSONFile('12VPnAH9O0tzXBqWwHIDCDAiIxThP0M7d').then(res => console.log(res))
          }}>
            get json file
          </button>
          <button onClick={() => {
            listFiles().then(res => console.log(res))
          }}>
            list files in folder
          </button>
        </div>
}

export { Homepage }