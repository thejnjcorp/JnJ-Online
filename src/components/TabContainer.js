import '../styles/TabContainer.scss';
import { useState } from 'react';

export function TabContainer({tabs}) {
    const [selectedTab, setSelectedTab] = useState(0);

    return <div className='TabContainer'>
        <div>
            {tabs.map((tab, index) => 
        <button 
            key={index} 
            className={selectedTab !== index ? 'TabButton' : 'TabButton TabButtonSelected'}
            onClick={() => setSelectedTab(index)}
        >
            {tab.tabName}
        </button>)}
        </div>
        <div>
            {tabs[selectedTab].content}
        </div>
    </div>
}