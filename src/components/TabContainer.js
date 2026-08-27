import '../styles/TabContainer.scss';
import { useState } from 'react';

export function TabContainer({tabs, container_height, content_height}) {
    const [selectedTab, setSelectedTab] = useState(0);
    const activeTab = tabs[selectedTab];

    // A per-tab contentHeight (unlike the content_height prop) sets a definite
    // height on .TabContainer-content, not just a cap - percentage/flex-based
    // sizing further down the tree (e.g. a combat map fitting to available
    // height) needs an actual definite height to resolve against, not an auto
    // height that's merely capped.
    //
    // .TabContainer itself is deliberately left to size naturally around its
    // real content (the tab-button row plus .TabContainer-content) rather than
    // being forced to match .TabContainer-content's height directly - it's the
    // parent of both, so forcing it to the same height as one of its two
    // stacked children is short by the other one's height. Since .TabContainer
    // uses overflow:visible (see the comment on that rule), a too-small height
    // wouldn't even clip anything - content would just spill past the box's own
    // background/rounded corners, which is exactly the bug this replaces.
    const containerStyle = container_height ? {maxHeight: container_height} : undefined;
    let contentStyle;
    if (activeTab.contentHeight) contentStyle = {height: activeTab.contentHeight, maxHeight: activeTab.contentHeight};
    else if (content_height) contentStyle = {maxHeight: content_height};

    return <div className='TabContainer' style={containerStyle}>
        <div className='TabContainer-tabs'>
            {tabs.map((tab, index) =>
        <button type="button"
            key={tab.tabName}
            className={selectedTab !== index ? 'TabButton' : 'TabButton TabButtonSelected'}
            onClick={() => setSelectedTab(index)}
        >
            {tab.icon}
            <span>{tab.tabName}</span>
        </button>)}
        </div>
        <div className='TabContainer-content' style={contentStyle}>
            {activeTab.content}
        </div>
    </div>
}