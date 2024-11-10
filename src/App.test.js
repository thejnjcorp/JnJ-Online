import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

test('renders webpage without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App/>, div);
});

test('goes to blog page when button is pressed', () => {
  
});