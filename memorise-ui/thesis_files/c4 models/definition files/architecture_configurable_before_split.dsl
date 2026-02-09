workspace "Memorise UI (Target Client-Only Architecture)" "Refactor direction based on discussion (boot sync, session working set, debounced persistence)" {

      model {
        properties {
             "structurizr.groupSeparator" "/"
        }
        
      
    externalApi = softwareSystem "External APIs" "External ML and translation APIs (Segmentation, Classification, NER, Translation)" "External System"
    Storage = softwareSystem "Storage" "Storage API, either local by default or based on supported adapters for MSSQL etc." "External System" 
    LogConsumer = softwareSystem "Log consumer" "Log consumer, could by file system, or console or any other logging system" "External System"
 

    system = softwareSystem "Data Curation Tool" "React-based annotation platform" {

        thesaurusWorker = container "Thesaurus Worker" "Background Web Worker for thesaurus indexing/search" "Web Worker" "Web Worker"
        softwareDatabase = container "System Database" "holds admin credentials and app configuration" "SQL database" "Database"
        
        webApp = container "Web Application" "The React frontend" "TyfpeScript/React" {

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
                    adminPage = component "AdminPage" "Admin UI" "React Component" "Page"
                }
            }   
                


            group "Application Layer" {
                applicationStorageService = component "StorageApplicationService" "Load/seed workspace metadata; load/commit workspace aggregates." "Application Service" "Application Service" 
                applicationWorkflowService = component "WorkflowApplicationService" "Orchestrates editor API calls like ner,segmentation and classify. Returns patches/deltas." "Application Service" "Application Service"
                applicationThesaurusService = component "ThesaurusApplicationService" "Thesaurus query abstraction (worker now; server later)." "Application Service"  "Application Service"
                applicationExportService = component "ExportApplicationService" "Orchestrates export (JSON/PDF) using infra export services." "Application Service" "Application Service"
                applicationConfigService = component "ConfigApplicationService" "updates configuration and calls adapter rebuild"
                
                applicationConfigApiEndpoint = component "ConfigAPIEndpoint" "provides Api for admin to set configuration for curation tool" "Application Service" "Application Service"
                applicationStorageApiEndpoint  = component "StorageAPIEndpoint" "provides http api endpoint for client to call workspace save/load operation"
                applicationWorkflowApiEndpoint = component "WorkflowAPIEndpoint" "provides http api endpoints for client to call ner,seg,translation,classify and thesaurus"
                applicationExportApiEndpoint = component "ExportAPIEndpoint" "provides http api endpoints for client to call ner,seg,translation,classify and thesaurus"
                
             
            }

            group "Core Layer" {
               
                coreUseCases = component "Workspace Use Cases" "CRUD/sync operations over aggregates." "Use Case"
               
            }

            group "Infrastructure Layer" {
                adapterRegistry = component "AdapterRegistry" "holds ready adapters for swapping via configuration"
                infrastructureRepositoryAdapter = component "StorageWorkspaceRepositoryAdapter" "Persistence implementation of predefined interface" "Repository"
                infrastructureApiClientAdapter = component "ApiClientAdapter" "HTTP client(s) for external APIs (direct fetch) implemented based on predefined interface." "Infrastructure Service"
                infrastructurePdfExport = component "PdfExportService" "PDF generation." "Infrastructure Service"
                infrastructureJsonExport = component "JsonExportService" "JSON export/download (client-side)." "Infrastructure Service"
                infrastructureErrorHandler = component "ErrorHandlingService" "Normalize/log infra errors; console output." "Infrastructure Service"
                infrastructureThesaurusAdapterAdapter = component "ThesaurusAdapter"  "Provides search results from thesaurus worker or API"
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
            adminPage -> presentationNotificationStore "Enqueues config change notices"

            # Login + metadata pages
            loginPage -> presentationWorkspaceStore "Sets username"
            manageWorkspacesPage -> presentationWorkspaceStore "Reads/updates workspace list"
            accountPage -> presentationWorkspaceStore "Reads workspace summaries/count"

            # Export flow
            manageWorkspacesPage -> applicationExportApiEndpoint "calls api to export data"
            applicationExportApiEndpoint -> applicationExportService "delegates to app service "
            applicationExportService -> infrastructurePdfExport "Delegates PDF export to"
            applicationExportService -> infrastructureJsonExport "Delegates JSON export to"

            # Synchronizer responsibilities
            presentationSynchronizer -> presentationWorkspaceStore "Reads username + workspace metadata"
            presentationSynchronizer -> presentationSessionStore "Loads active workspace working set"
            
            presentationSynchronizer -> applicationStorageApiEndpoint "Loads/seeds metadata; loads workspace aggregates"
            
           

            # Workspace page composition
            workspacePage -> presentationEditorContainer "Delegates to"
            workspacePage -> presentationBookmarkContainer "Delegates to"
            workspacePage -> presentationPanelContainer "Delegates to"
            

            presentationEditorContainer -> presentationSessionStore "Reads/writes working set"
            presentationBookmarkContainer -> presentationSessionStore "Reads/writes working set"
            presentationPanelContainer -> presentationSessionStore "Reads/writes working set"

            # Editing / API usage (UPDATED: panel does NOT call editor service)
            presentationEditorContainer -> applicationWorkflowApiEndpoint "Requests classify/NER/segmentation + annotation/tag ops (returns patch)"
            presentationBookmarkContainer -> applicationWorkflowApiEndpoint "Requests translation (returns patch)"
            
            # Admin Page
            adminPage -> applicationConfigApiEndpoint "updates application configuration through"

            # Thesaurus search (via right panel)
            presentationPanelContainer -> applicationWorkflowApiEndpoint "Searches thesaurus via"
            applicationThesaurusService -> infrastructureThesaurusAdapterAdapter "Sends local thesaurus request messages "
            applicationThesaurusService -> adapterRegistry "laadsAdapter from"
            infrastructureThesaurusAdapterAdapter -> infrastructureApiClientAdapter "Delegates remote search requests "
            infrastructureThesaurusAdapterAdapter -> thesaurusWorker "Delegates local search requests to "

            # Application/Core wiring
            applicationStorageService -> coreUseCases "Executes"
            applicationStorageService -> adapterRegistry "loadsAdapter from"

            applicationWorkflowService -> infrastructureApiClientAdapter "Calls external APIs via"
            applicationWorkflowService -> adapterRegistry "loads adapter from"
            
            applicationStorageApiEndpoint -> applicationStorageService "calls storage service to load/update storage data"
           
            
            applicationWorkflowApiEndpoint -> applicationWorkflowService "calls "
            applicationWorkflowApiEndpoint -> applicationThesaurusService "calls"

            # Persistence wiring
            coreUseCases -> infrastructureRepositoryAdapter "Persists/loads"
            adapterRegistry -> softwareDatabase "loads configuration through"
            infrastructureRepositoryAdapter -> Storage "Reads/writes data"
            infrastructureRepositoryAdapter -> infrastructureErrorHandler "Wraps infra exceptions with"
            
            applicationConfigApiEndpoint -> applicationConfigService "delegates to"
            
            applicationConfigService -> softwareDatabase "stores configuration updates and reads"
            applicationConfigService -> adapterRegistry "calls to swap or reconfigure adapters"
            
            adapterRegistry -> infrastructureApiClientAdapter "creates / updates instance"
            adapterRegistry -> infrastructureThesaurusAdapterAdapter "creates / updates instance"
            adapterRegistry -> infrastructureRepositoryAdapter "creates / updates instance"

            # External API wiring
            infrastructureApiClientAdapter -> externalApi "HTTP requests"
            infrastructureApiClientAdapter -> infrastructureErrorHandler "Normalizes/reports failures"

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
            
            element "Database" {
                shape Cylinder
           
                
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