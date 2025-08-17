import React, { createContext, useState, useContext } from 'react';

const WorkstreamContext = createContext();

export const useWorkstream = () => useContext(WorkstreamContext);

export const WorkstreamProvider = ({ children }) => {
    const [needsRefresh, setNeedsRefresh] = useState(false);

    const triggerRefresh = () => {
        setNeedsRefresh(true);
    };

    const resetRefresh = () => {
        setNeedsRefresh(false);
    };

    return (
        <WorkstreamContext.Provider value={{ needsRefresh, triggerRefresh, resetRefresh }}>
            {children}
        </WorkstreamContext.Provider>
    );
};
