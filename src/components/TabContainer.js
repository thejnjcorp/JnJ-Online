import '../styles/TabContainer.scss';
import { useState } from 'react';

export function TabContainer({tabs, container_height, content_height}) {
    const [selectedTab, setSelectedTab] = useState(0);

    return <div className='TabContainer' style={container_height ? {maxHeight: container_height} : undefined}>
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
        <div className='TabContainer-content' style={content_height ? {maxHeight: content_height} : undefined}>
            {tabs[selectedTab].content}
        </div>
    </div>
}