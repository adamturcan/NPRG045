workspace "Memorise UI Actual Architecture" "Architectural state as of October 2023 - Based on Code Analysis" {

    model {
        externalApi = softwareSystem "External APIs" "External ML and translation APIs (Segmentation, Classification, NER, Translation)" "External System"
        
        browserStorage = softwareSystem "Browser Storage" "LocalStorage API" "External System"
        browserConsole = softwareSystem "Browser Console" "Standard Output / DevTools" "External System"

        system = softwareSystem "Memorise UI" "React-based annotation platform" {
            
            thesaurusWorker = container "Thesaurus Worker" "Background Web Worker for search indexing (Fuse.js)" "Web Worker"

            webApp = container "Web Application" "The React frontend" "TypeScript/React" {

                # SHARED KERNEL
                group "Shared Kernel" {
                    sharedApiUtils = component "Shared API Utils" "Direct fetch wrappers (api.ts, translation.ts)." "Shared Utility"
                    # sharedDomainConstants = component "Shared Domain Constants" "Entity colors, categories (constants/notationEditor.ts)." "Shared Utility"
                    sharedPdfHelpers = component "Shared PDF Helpers" "Text processing for PDF (pdfHelpers.ts)." "Shared Utility"
                    sharedPresentationUtils = component "Shared UI Utils" "DOM calculation logic (editorDom.ts)." "Shared Utility"
                    sharedThesaurusHelpers = component "Shared Thesaurus Helpers" "Hierarchy building logic (thesaurusHelpers.ts)." "Shared Utility"
                    # sharedWebVitals = component "Web Vitals" "Performance metrics reporting (webVitals.ts)." "Shared Utility"
                }

                # PRESENTATION LAYER
                group "Presentation Layer" {
                    appOrchestrator = component "App Orchestrator" "Top-level app orchestrator (main.tsx/App.tsx). Configures ErrorBoundary and WebVitals." "React Component"
                    presentationWorkspaceStore = component "WorkspaceStore" "Zustand store. USES SERVICE LOCATOR to get AppService." "State Store"
                    presentationSessionStore = component "SessionStore" "Zustand store. USES SERVICE LOCATOR to get AppService." "State Store"
                    
                    presentationEditorContainer = component "EditorContainer" "Main editor container."
                    presentationBookmarkContainer = component "BookmarkContainer" "editors translation bookmark panel container."
                    presentationPanelContainer = component "PanelContainer" "Main editors right panel container."
                    
                    # Explicit Components
                    presentationSidebar = component "BubbleSidebar" "Sidebar navigation." "React Component"
                    presentationNotification = component "NotificationSnackbar" "Notification display." "React Component"
                    presentationErrorBoundary = component "ErrorBoundary" "React error boundary. Catches render errors, logs to console, and delegates to handler." "React Component"
                    presentationSynchronizer = component "StateSynchronizer" "runtime unit that synchronizes session and global state" "React component"
                    
                    # Pages
                    loginPage = component "LoginPage" "User authentication page." "React Component"
                    workspacePage = component "WorkspacePage" "Workspace editing page wrapper." "React Component"
                    manageWorkspacesPage = component "ManageWorkspacesPage" "Workspace management page." "React Component"
                    accountPage = component "AccountPage" "User account page." "React Component"
                }

                # APPLICATION LAYER
                group "Application Layer" {
                    applicationWorkspaceService = component "WorkspaceApplicationService" "Orchestrates Use Cases. Handles complex merging of 'Segments' metadata." "Application Service"
                    applicationAPIService = component "APIApplicationService" "Orchestrates Use Cases. Handles complex merging of 'Segments' metadata." "Application Service"
                    applicationErrorPresenter = component "ErrorPresenter" "Transforms AppErrors for UI." "Application Service"
                }

                # CORE LAYER
                group "Core Layer" {
                    coreEntities = component "Entities" "Rich Domain Models (Workspace, Tag, Annotation)." "Entity"
                    coreMappers = component "Data Mappers" "Translates between Rich Entities and Anemic DTOs." "Mapper"
                    coreUseCases = component "Workspace Use Cases" "CRUD and Sync logic." "Use Case"
                    coreDomainServices = component "Domain Services" "Pure domain logic (resolveApiSpanConflicts.ts)." "Domain Service"
                }

                # INFRASTRUCTURE LAYER
                group "Infrastructure Layer" {
                    infrastructureProviders = component "Service Providers" "Service Locator pattern (workspaceProvider.ts, apiProvider.ts)." "Provider"
                    infrastructureRepository = component "LocalStorageWorkspaceRepository" "Persistence implementation." "Repository"
                    infrastructureApiService = component "ApiServices" "Facade/Adapter for API calls." "Infrastructure Service"
                    infrastructureErrorHandler = component "ErrorHandlingService" "Centralized error handling. Normalizes errors and Logs to Console." "Infrastructure Service"
                    infrastructurePdfExport = component "PdfExportService" "PDF generation." "Infrastructure Service"
                }

                # RELATIONSHIPS

                # Orchestrator to Pages & UI
                appOrchestrator -> loginPage "Routes to"
                appOrchestrator -> workspacePage "Routes to"
                appOrchestrator -> manageWorkspacesPage "Routes to"
                appOrchestrator -> accountPage "Routes to"
                appOrchestrator -> presentationSidebar "Renders"
                appOrchestrator -> presentationNotification "Renders (Global)"
                appOrchestrator -> presentationSynchronizer "Calls debounced"
                presentationErrorBoundary -> appOrchestrator "Handles render errors from"
                
                loginPage -> presentationWorkspaceStore "locates user workspaces"
                accountPage -> presentationWorkspaceStore "loads user workspaceCount"
                manageWorkspacesPage -> presentationWorkspaceStore "reads and updates workspaces"
                
                
                # Global Error Handling & Vitals in Orchestrator (main.tsx)
                # appOrchestrator -> sharedWebVitals "Initializes"
                presentationSynchronizer -> applicationWorkspaceService "saves  and loads workspace through"   
                
                
                presentationSynchronizer -> presentationSessionStore "loads session state"
                presentationSynchronizer -> presentationWorkspaceStore "updates workspace store"

                # Pages wiring
                workspacePage -> presentationEditorContainer "Delegates to"
                workspacePage -> presentationBookmarkContainer "Delegates to"
                workspacePage -> presentationPanelContainer "Delegates to"
                workspacePage -> infrastructureProviders "locates api services"
                
                presentationEditorContainer -> presentationSessionStore "Manages state through"
                presentationPanelContainer -> presentationSessionStore "Manages state through"
                presentationBookmarkContainer -> presentationSessionStore "Manages state through"
                
                presentationEditorContainer -> applicationAPIService "calls segmentation,ner and tag"
                presentationBookmarkContainer -> applicationAPIService "calls translation"
                

                # Presentation Wiring
                presentationSynchronizer -> infrastructureProviders "Locates WorkspaceAppService via"
                
                # Providers wiring
                infrastructureProviders -> applicationWorkspaceService "Instantiates"
                infrastructureProviders -> infrastructureRepository "Instantiates"
                infrastructureProviders -> infrastructureApiService "Instantiates"

                # Application Layer Logic
                applicationWorkspaceService -> coreUseCases "Executes"
                applicationWorkspaceService -> coreMappers "Uses for DTO conversions"
                
                # Error Presenter Flow (Logic -> Data, not Logic -> UI Component)
                appOrchestrator -> applicationErrorPresenter "Uses to format errors"
                

                # Core Logic
                coreUseCases -> infrastructureRepository "Persists data"
                coreDomainServices -> coreEntities "Manipulates"
                coreUseCases -> infrastructureErrorHandler "Creates AppErrors (Validation)"

                # Data Persistence Flow
                infrastructureRepository -> coreMappers "Uses for persistence mapping"
                infrastructureRepository -> browserStorage "Reads/Writes JSON"
                infrastructureRepository -> infrastructureErrorHandler "Wraps exceptions with"

                # Infrastructure Implementation
                infrastructureApiService -> sharedApiUtils "Delegates fetch calls to"
                infrastructureApiService -> infrastructureErrorHandler "Reports errors to (returns/throws)"
                infrastructureApiService -> externalApi "Makes HTTP requests to"
                
                infrastructurePdfExport -> sharedPdfHelpers "Uses for text layout"
                # infrastructurePdfExport -> sharedDomainConstants "Uses for colors"
                infrastructurePdfExport -> sharedThesaurusHelpers "Uses for hierarchy"
                sharedApiUtils -> infrastructureErrorHandler "Normalizes and logs erros with"
                
                # ERROR HANDLING OUTPUT
                infrastructureErrorHandler -> browserConsole "Logs errors to (console.error)"
                
                # Shared Kernel Output
                # sharedWebVitals -> browserConsole "Logs metrics to"

                # External Communication
                sharedApiUtils -> externalApi "Makes HTTP requests to"
                
                # Worker Communication
               
            }
        }
    }

    views {
        component webApp "ActualArchitecture" {
            include *
            title "Memorise UI - Actual Architecture (Detailed)"
            description "Detailed view including Pages, Web Worker, and Browser Storage."
        }
        
        theme default

        styles {
            element "Shared Utility" {
                background #e0e0e0
                shape RoundedBox
                color #000000
            }
            element "Provider" {
                background #fff9c4
                shape Hexagon
                color #000000
            }
            element "Mapper" {
                background #f3e5f5
                shape Circle
                color #000000
            }
            element "Domain Service" {
                background #e1bee7
                color #000000
            }
            element "Entity" {
                background #b3e5fc
                color #000000
            }
            element "Application Service" {
                background #c8e6c9
                color #000000
            }
            element "React Component" {
                background #e1f5ff
                color #000000
            }
            element "React Hooks" {
                background #ffe0b2
                color #000000
            }
            element "State Store" {
                background #ffecb3
                color #000000
            }
            element "External System" {
                background #ffcdd2
                color #000000
            }
            element "Web Worker" {
                background #dcedc8
                shape Hexagon
                color #000000
            }
        }
    }
}