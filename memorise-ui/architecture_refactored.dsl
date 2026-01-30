workspace "Memorise UI (Target Client-Only Architecture)" "Refactor direction based on discussion (boot sync, session working set, debounced persistence)" {

      model {
        properties {
             "structurizr.groupSeparator" "/"
        }
        
      
    externalApi = softwareSystem "External APIs" "External ML and translation APIs (Segmentation, Classification, NER, Translation)" "External System"
    Storage = softwareSystem "Storage" "Storage API, either local by default or based on supported adapters for MSSQL etc." "External System" 
    LogConsumer = softwareSystem "Log consumer" "Log consumer, could by file system, or console or any other logging system" "External System"

    system = softwareSystem "Memorise UI" "React-based annotation platform" {

        thesaurusWorker = container "Thesaurus Worker" "Background Web Worker for thesaurus indexing/search" "Web Worker" "Web Worker"

        webApp = container "Web Application" "The React frontend" "TypeScript/React" {

            group "Presentation Layer" {
                appOrchestrator = component "App Orchestrator" "Routes + global layout + mounts synchronizer + renders global snackbar." "React Component"
                group "Stores" {
                    presentationWorkspaceStore = component "WorkspaceStore" "Identity (username) + workspace metadata list + currentWorkspaceId." "State Store" "State Store" 
                    presentationSessionStore = component "SessionStore" "Active workspace working set (text/spans/tags/translations) + dirty/lastChangedAt." "State Store" "State Store"
                    presentationNotificationStore = component "NotificationStore" "Central notification queue/state." "State Store" "State Store"
                }
                presentationSynchronizer = component "StateSynchronizer" "Boot sync + route sync + debounced persistence (SessionStore -> storage)." "React Component"

                presentationEditorContainer = component "EditorContainer" "Editor area container (buttons trigger classify/NER/segmentation; updates SessionStore)." "React Component"
                presentationBookmarkContainer = component "BookmarkContainer" "Bookmark/translation container." "React Component"
                presentationPanelContainer = component "PanelContainer" "Right panel container (thesaurus search + tags/segments UI)." "React Component"

                presentationNotification = component "NotificationSnackbar" "Global notification renderer." "React Component"
               
            
                group "Pages" {
                    loginPage = component "LoginPage" "Sets username into WorkspaceStore." "React Component" "Page"
                    workspacePage = component "WorkspacePage" "Composes editor containers; provides notify() to editor subtree." "React Component" "Page"
                    manageWorkspacesPage = component "ManageWorkspacesPage" "Workspace management UI + export actions." "React Component" "Page"
                    accountPage = component "AccountPage" "Account UI." "React Component" "Page"
                }
            }   
                


            group "Application Layer" {
                applicationStorageService = component "StorageApplicationService" "Load/seed workspace metadata; load/commit workspace aggregates." "Application Service" "Application Service" 
                applicationWorkflowService = component "WorkflowApplicationService" "Orchestrates editor API calls like ner,segmentation and classify. Returns patches/deltas." "Application Service" "Application Service"
                applicationThesaurusService = component "ThesaurusApplicationService" "Thesaurus query abstraction (worker now; server later)." "Application Service"  "Application Service"
                applicationExportService = component "ExportApplicationService" "Orchestrates export (JSON/PDF) using infra export services." "Application Service" "Application Service"
             
            }

            group "Core Layer" {
               
                coreUseCases = component "Workspace Use Cases" "CRUD/sync operations over aggregates." "Use Case"
               
            }

            group "Infrastructure Layer" {
                infrastructureProviders = component "Service Providers" "Service locator for app services (used by Synchronizer; optionally pages)." "Provider" "Provider"
                infrastructureRepository = component "StorageWorkspaceRepository" "Persistence implementation of predefined interface" "Repository"
                infrastructureApiClient = component "ApiClient" "HTTP client(s) for external APIs (direct fetch) implemented based on predefined interface." "Infrastructure Service"
                infrastructurePdfExport = component "PdfExportService" "PDF generation." "Infrastructure Service"
                infrastructureJsonExport = component "JsonExportService" "JSON export/download (client-side)." "Infrastructure Service"
                infrastructureErrorHandler = component "ErrorHandlingService" "Normalize/log infra errors; console output." "Infrastructure Service"
                infrastructureThesaurusAdapter = component "ThesaurusAdapter"  "Provides search results from thesaurus worker or API"
            }

            # -------------------- RELATIONSHIPS --------------------

            # Orchestrator / routing / UI shell
            appOrchestrator -> presentationSynchronizer "Mounts / drives"
            appOrchestrator -> loginPage "Routes to"
            appOrchestrator -> workspacePage "Routes to"
            appOrchestrator -> manageWorkspacesPage "Routes to"
            appOrchestrator -> accountPage "Routes to"
           
            appOrchestrator -> presentationNotification "Renders (global)"

            # Central notifications (one renderer, multiple producers)
            presentationNotification -> presentationNotificationStore "Renders notifications from"
            appOrchestrator -> presentationNotificationStore "Enqueues global notices (save/rollback/etc)"
            workspacePage -> presentationNotificationStore "Enqueues editor notices (via notify())"
            manageWorkspacesPage -> presentationNotificationStore "Enqueues export notices"

            # Login + metadata pages
            loginPage -> presentationWorkspaceStore "Sets username"
            manageWorkspacesPage -> presentationWorkspaceStore "Reads/updates workspace list"
            accountPage -> presentationWorkspaceStore "Reads workspace summaries/count"

            # Export flow
            manageWorkspacesPage -> applicationExportService "Exports (JSON/PDF) via"
            applicationExportService -> infrastructurePdfExport "Delegates PDF export to"
            applicationExportService -> infrastructureJsonExport "Delegates JSON export to"

            # Synchronizer responsibilities
            presentationSynchronizer -> presentationWorkspaceStore "Reads username + workspace metadata"
            presentationSynchronizer -> presentationSessionStore "Loads active workspace working set"
            presentationSynchronizer -> infrastructureProviders "Locates storage application services via"
            presentationSynchronizer -> applicationStorageService "Loads/seeds metadata; loads workspace aggregates"
           

            # Workspace page composition
            workspacePage -> presentationEditorContainer "Delegates to"
            workspacePage -> presentationBookmarkContainer "Delegates to"
            workspacePage -> presentationPanelContainer "Delegates to"
            workspacePage -> infrastructureProviders "locates API application services through"

            presentationEditorContainer -> presentationSessionStore "Reads/writes working set"
            presentationBookmarkContainer -> presentationSessionStore "Reads/writes working set"
            presentationPanelContainer -> presentationSessionStore "Reads/writes working set"

            # Editing / API usage (UPDATED: panel does NOT call editor service)
            presentationEditorContainer -> applicationWorkflowService "Requests classify/NER/segmentation + annotation/tag ops (returns patch)"
            presentationBookmarkContainer -> applicationWorkflowService "Requests translation (returns patch)"

            # Thesaurus search (via right panel)
            presentationPanelContainer -> applicationThesaurusService "Searches thesaurus via"
            applicationThesaurusService -> infrastructureThesaurusAdapter "Sends local thesaurus request messages "
            infrastructureThesaurusAdapter -> infrastructureApiClient "Delegates remote search requests "
            infrastructureThesaurusAdapter -> thesaurusWorker "Delegates local search requests to "

            # Application/Core wiring
            applicationStorageService -> coreUseCases "Executes"
           

            applicationWorkflowService -> infrastructureApiClient "Calls external APIs via"
           

            # Persistence wiring
            coreUseCases -> infrastructureRepository "Persists/loads"
           
            infrastructureRepository -> Storage "Reads/writes data"
            infrastructureRepository -> infrastructureErrorHandler "Wraps infra exceptions with"

            # External API wiring
            infrastructureApiClient -> externalApi "HTTP requests"
            infrastructureApiClient -> infrastructureErrorHandler "Normalizes/reports failures"

            # Error output (no boundary -> infra error service relationship)
            infrastructureErrorHandler -> LogConsumer "Sends logs to "
        }
    }
}

    views {
        component webApp "TargetArchitecture" {
            include *
            title "Memorise UI - Target Architecture (Client-only, refactor direction)"
            description "Adds AuthStore/SessionStore/Synchronizer + makes worker + persistence explicit."
        }

        theme default

        styles {
            
            element "Group:Presentation Layer/Pages" {
                color #ff0000
                stroke #ff0000
                strokeWidth 10
            }
            
            element "Group:Presentation Layer/Stores" {
                color Blue
                stroke Blue
                strokeWidth 10
            }
            
            
            element "Page" {
              shape WebBrowser
            }
            
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