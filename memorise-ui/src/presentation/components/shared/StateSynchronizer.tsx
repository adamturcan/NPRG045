import { useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';


interface StateSynchronizerProps {
    username: string | null;
    children?: React.ReactNode;
    }



export const StateSynchronizer: React.FC<StateSynchronizerProps> = ({ children }) => {
    const isDirty = useSessionStore((state) => state.isDirty);
    // const workspaceId = useSessionStore((state) => state.workingSet.workspaceId);


    /// make sure stores are initialized, metadata is loaded, etc. 
    //      !!TODO 
    useEffect(() => {
        const handleAppMount = () => {
            console.log('App mounted');
        };
        window.addEventListener('load', handleAppMount);
    }, []);

    useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = ''; // Required for Chrome
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);
  
    // const { save } = useWorkspaceActions();

    // useEffect(() => {
    // if (isDirty && autoSaveEnabled) { // You can toggle this easily now
    //     void debouncedSave(save); 
    // }
    // }, [isDirty, save]);
    
    // const debouncedSave = useMemo(() => debounceAsync(saveAction, 1000), [workspaceId]);

    
    // useEffect(() => {
    // if (isDirty && workspaceId) {
    //     void debouncedSave();
    // }
    // }, [isDirty, workspaceId, debouncedSave]);
  
    return <>{children}</>;
  };