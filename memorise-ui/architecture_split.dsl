workspace "Memorise UI (Split Architecture)" "Refactor: Client-Side React SPA + Backend API" {

    model {
        properties {
             "structurizr.groupSeparator" "/"
        }

        # ============================================================
        # ACTORS
        # ============================================================
        user = person "Annotator" "A user who annotates text, manages workspaces, and exports data."
        admin = person "Administrator" "A user who manages system configuration and infrastructure settings."

        # ============================================================
        # EXTERNAL SYSTEMS
        # ============================================================
        externalApi = softwareSystem "External APIs" "External ML/Translation APIs (NER, Seg, Classify)" "External System"
        Storage = softwareSystem "Storage" "Physical Storage (File System, MSSQL, S3)" "External System"
        LogConsumer = softwareSystem "Log Consumer" "Splunk / CloudWatch / Console" "External System"

        system = softwareSystem "Data Curation Tool" "React-based annotation platform" {

            thesaurusWorker = container "Thesaurus Worker" "Background Worker for indexing" "Worker Process" "Web Worker"
            softwareDatabase = container "System Database" "Holds admin credentials & config" "SQL database" "Database"

            # ============================================================
            # CONTAINER 1: CLIENT (Browser)
            # ============================================================
            webApp = container "Web Application" "React Frontend (SPA)" "TypeScript/React" "Web Browser" {

                # Group 1: The "Shell" that holds the app together
                group "Routing & Shell" {
                    appOrchestrator = component "App Orchestrator" "Root Component: Routes, Layouts, Global Providers." "React Component" "React Component"
                    presentationSynchronizer = component "StateSynchronizer" "React Effect: Boot sync, Route sync, Auto-save." "React Component" "React Component"
                    presentationNotification = component "NotificationSnackbar" "UI: Renders global toasts/alerts." "React Component" "React Component"
                }

                # Group 2: State Management (Data in Memory)
                group "State Stores" {
                    presentationWorkspaceStore = component "WorkspaceStore" "Zustand/Redux: User Identity & Workspace List." "State Store" "State Store"
                    presentationSessionStore = component "SessionStore" "Zustand/Redux: Active Working Set (Dirty checking)." "State Store" "State Store"
                    presentationNotificationStore = component "NotificationStore" "Zustand/Redux: Central message queue." "State Store" "State Store"
                }

                # Group 3: High-Level Pages (Routes)
                group "Pages" {
                    loginPage = component "LoginPage" "Route: /login" "Page Component" "Page Component"
                    workspacePage = component "WorkspacePage" "Route: /workspace/:id" "Page Component" "Page Component"
                    manageWorkspacesPage = component "ManageWorkspacesPage" "Route: /workspaces" "Page Component" "Page Component"
                    accountPage = component "AccountPage" "Route: /account" "Page Component" "Page Component"
                    adminPage = component "AdminPage" "Route: /admin" "Page Component" "Page Component"
                }

                # Group 4: UI Containers (Layout blocks inside Pages)
                group "UI Layout Containers" {
                    presentationEditorContainer = component "EditorContainer" "Central Canvas: Text & Annotations." "React Component" "React Component"
                    presentationBookmarkContainer = component "BookmarkContainer" "Left Panel: Navigation & Bookmarks." "React Component" "React Component"
                    presentationPanelContainer = component "PanelContainer" "Right Panel: Thesaurus & Metadata." "React Component" "React Component"
                }

                # Group 5: Client-Side Infrastructure (Logic that doesn't render UI)
                group "Client Infrastructure" {
                    infrastructureConfigClient = component "ConfigClient" "Service: Fetches & caches boot configuration." "Client Service"  "Client Service"
                    infrastructureStorageGateway = component "StorageGateway" "Service: Routes save() to Local or Remote." "Client Service" "Client Service"
                    infrastructureLocalStorageAdapter = component "LocalStorageAdapter" "Adapter: IndexedDB / LocalStorage wrapper." "Client Service" "Client Service"
                }
            }

            # ============================================================
            # CONTAINER 2: BACKEND (Server)
            # ============================================================
            backendApi = container "Backend API" "Node/Go/Java Server" "Server API" "Server Container" {

                # Group 1: The API Surface (Controllers)
                group "API Layer" {
                    applicationConfigApiEndpoint = component "ConfigAPI" "POST /api/config" "API Endpoint" "API Endpoint"
                    applicationStorageApiEndpoint = component "StorageAPI" "POST /api/storage" "API Endpoint" "API Endpoint"
                    applicationWorkflowApiEndpoint = component "WorkflowAPI" "POST /api/workflow" "API Endpoint" "API Endpoint"
                    applicationExportApiEndpoint = component "ExportAPI" "POST /api/export" "API Endpoint" "API Endpoint"
                }

                # Group 2: Business Logic (Services)
                group "Application Services" {
                    applicationStorageService = component "StorageService" "Logic: Loading, Merging, Validation." "App Service" "App Service" 
                    applicationWorkflowService = component "WorkflowService" "Logic: ML Pipeline Orchestration." "App Service" "App Service"
                    applicationThesaurusService = component "ThesaurusService" "Logic: Abstract search interface." "App Service" "App Service"
                    applicationExportService = component "ExportService" "Logic: Data formatting & file generation." "App Service"  "App Service"
                    applicationConfigService = component "ConfigService" "Logic: Configuration management." "App Service" "App Service"
                }

                # Group 3: The Core Domain (Pure Logic)
                group "Core Domain" {
                    coreUseCases = component "Core Use Cases" "Pure Domain Entities & Rules." "Use Case"  "Use Case"
                }

                # Group 4: Server Infrastructure (Plumbing)
                group "Infrastructure Layer" { 
                    adapterRegistry = component "AdapterRegistry" "Factory: Swaps implementations based on config." "Infra Service" "Infra Service"
                    
                    # Adapters
                    infrastructureRepositoryAdapter = component "StorageRepositoryAdapter" "SQL/File implementation." "Repository" "Repository"
                    infrastructureApiClientAdapter = component "ExternalApiAdapter" "Axios/Fetch wrapper for ML APIs." "Infra Service" "Infra Service"
                    infrastructureThesaurusAdapterAdapter = component "ThesaurusAdapter" "Connector to Worker or Search Engine." "Infra Service" "Infra Service"
                    infrastructureConfigurationAdapter = component "ConfigAdapter" "Config db call wrapper" "Infra service" "Infra Service"
                    
                    # Engines
                    infrastructurePdfExport = component "PdfEngine" "PDF Generation Library." "Infra Service" "Infra Service"
                    infrastructureJsonExport = component "JsonEngine" "JSON Generation Library." "Infra Service" "Infra Service"
                    
                    # Utils
                    infrastructureErrorHandler = component "ErrorHandler" "Global Exception Catcher." "Infra Service" "Infra Service"
                }
            }

            # ============================================================
            # RELATIONSHIPS
            # ============================================================

            # 0. Actors -> System
            user -> webApp "Uses to annotate data"
            admin -> webApp "Uses to configure system"

            # 1. Bootstrapping (The Critical Start)
            
            infrastructureConfigClient -> applicationConfigApiEndpoint "2. HTTP GET /config"

            # 2. Routing & Navigation
            appOrchestrator -> loginPage "Routes"
            appOrchestrator -> workspacePage "Routes"
            appOrchestrator -> manageWorkspacesPage "Routes"
            appOrchestrator -> adminPage "Routes"
            appOrchestrator -> accountPage "Routes"
            appOrchestrator -> presentationSynchronizer "Mounts"
            appOrchestrator -> presentationNotification "Renders"

            # 3. State Management Flow
            loginPage -> presentationWorkspaceStore "Updates User"
            manageWorkspacesPage -> presentationWorkspaceStore "Reads / Updates Workspaces"
            accountPage -> presentationWorkspaceStore "Reads workspaces"
            presentationSynchronizer -> presentationWorkspaceStore "Reads Metadata"
            presentationSynchronizer -> presentationSessionStore "Monitors for Changes"
            
            # 4. Storage Flow (The Gateway Pattern)
            presentationSynchronizer -> infrastructureConfigClient "Checks Mode (Local/Remote)"
            presentationSynchronizer -> infrastructureStorageGateway "Calls save()"
            
            infrastructureStorageGateway -> infrastructureLocalStorageAdapter "If Local"
            infrastructureStorageGateway -> applicationStorageApiEndpoint "If Remote"

            # 5. UI Layout Composition
            workspacePage -> presentationEditorContainer "Renders"
            workspacePage -> presentationBookmarkContainer "Renders"
            workspacePage -> presentationPanelContainer "Renders"
         
            
            presentationEditorContainer -> presentationSessionStore "Reads/Writes"
            presentationBookmarkContainer -> presentationSessionStore "Reads/Writes"
            presentationPanelContainer -> presentationSessionStore "Reads/Writes"
            
            workspacePage -> presentationNotificationStore "Enqueues notices"
            adminPage -> presentationNotificationStore "Enqueues notices"
            manageWorkspacesPage -> presentationNotificationStore "Enqueues notices"
            presentationNotification -> presentationNotificationStore "Renders notifications from "

            # 6. Client -> Backend API Calls
            
            # Storage
            applicationStorageApiEndpoint -> applicationStorageService "Delegates"
            
            # ML & Workflow
            presentationEditorContainer -> applicationWorkflowApiEndpoint "Triggers ML"
            presentationBookmarkContainer -> applicationWorkflowApiEndpoint "Triggers Translate"
            presentationPanelContainer -> applicationWorkflowApiEndpoint "Triggers Search"
            applicationWorkflowApiEndpoint -> applicationWorkflowService "Delegates"
            applicationWorkflowApiEndpoint -> applicationThesaurusService "Delegates"

            # Export
            manageWorkspacesPage -> applicationExportApiEndpoint "Request Export"
            applicationExportApiEndpoint -> applicationExportService "Delegates"

            # Admin & Config Update
            adminPage -> applicationConfigApiEndpoint "Updates Settings"
            adminPage -> infrastructureConfigClient "Triggers Refresh"
            applicationConfigApiEndpoint -> applicationConfigService "Delegates"

            # 7. Backend Internal Wiring
            
            # Service -> Infra
            applicationStorageService -> coreUseCases "Uses"
            
            coreUseCases -> infrastructureRepositoryAdapter "Persists / loads"
            
            applicationStorageService -> adapterRegistry "Gets Adapter"
            applicationWorkflowService -> adapterRegistry "Gets Adapter"
            applicationThesaurusService -> adapterRegistry "Gets Adapter"
            
            
            applicationWorkflowService -> infrastructureApiClientAdapter "Sends External API requests through"
            applicationThesaurusService -> infrastructureThesaurusAdapterAdapter "Sends thesaurus requests through"
            infrastructureThesaurusAdapterAdapter -> infrastructureApiClientAdapter "Delegates remote search requests"
            
            applicationExportService -> infrastructurePdfExport "Generates PDF"
            applicationExportService -> infrastructureJsonExport "Generates JSON"

            applicationConfigService -> infrastructureConfigurationAdapter "delegates"
            
            infrastructureConfigurationAdapter -> softwareDatabase "Persists Config"
            applicationConfigService -> adapterRegistry "Re-configures Adapters"

            # Registry Resolution
            adapterRegistry -> infrastructureRepositoryAdapter "Provides"
            adapterRegistry -> infrastructureApiClientAdapter "Provides"
            adapterRegistry -> infrastructureThesaurusAdapterAdapter "Provides"

            # Infra -> External
            infrastructureRepositoryAdapter -> Storage "R/W"
            infrastructureApiClientAdapter -> externalApi "HTTPS"
            infrastructureThesaurusAdapterAdapter -> thesaurusWorker "Msg"
            
            # Error Handling
            infrastructureRepositoryAdapter -> infrastructureErrorHandler "Reports"
            infrastructureApiClientAdapter -> infrastructureErrorHandler "Reports"
            infrastructureErrorHandler -> LogConsumer "Logs"
        }
    }

    views {
        # View 1: Top-Level Landscape (Actors + Systems)
        systemContext system "SystemLandscape" {
            include *
            title "Memorise - System Landscape"
            description "Actors and External Systems interacting with the Tool."
        }

        # View 2: Container Split (Frontend vs Backend)
        container system "SystemContainers" {
            include *
            title "Memorise - Container Architecture"
            description "High-level split: React Client, Backend API, Workers, and DB."
        }

        # View 3: Client Detail
        component webApp "ClientArchitecture" {
            include *
            include backendApi
            title "Memorise UI - Client Architecture"
            description "React Presentation Layer + Client Infrastructure."
        }
        
        # View 4: Backend Detail
        component backendApi "BackendArchitecture" {
            include *
            include webApp
            title "Memorise API - Backend Architecture"
            description "Services, Domain, and Adapters."
        }

        theme default

        styles {
            # --- CONTAINERS (Colored) ---
            element "Web Browser" {
                background #e3f2fd
                color #0d47a1
                stroke #0d47a1
                strokeWidth 2
            }
            element "Server Container" {
                background #f3e5f5
                color #4a148c
                stroke #4a148c
                strokeWidth 2
            }
            element "Database" {
                shape Cylinder
                background #eceff1
                color #000000
                stroke #37474f
            }
            element "Web Worker" {
                shape Hexagon
                background #e8f5e9
                color #1b5e20
            }

            # --- COMPONENTS ---
            element "Person" {
                shape Person
                background #0d47a1
                color #ffffff
            }

            # Client Components (Blue Theme)
            element "React Component" {
                background #ffffff
                color #000000
                stroke #1e88e5
            }
            element "Page Component" {
                background #ffffff
                color #000000
                stroke #d32f2f
                strokeWidth 3
                shape WebBrowser
            }
            
            # --- UPDATED STORES ---
            element "State Store" {
                background #ffe0b2
                color #000000
                shape RoundedBox
                stroke #ef6c00
                strokeWidth 2
            }
            
             element "Client Service" {
                background #fafafa
                color #000000
                shape RoundedBox
                stroke #757575
            }

            # Backend Components (Purple/Green Theme)
            element "API Endpoint" {
                background #ffffff
                color #000000
                shape RoundedBox
                stroke #7b1fa2
                strokeWidth 2
            }
            element "App Service" {
                background #f1f8e9
                color #000000
                shape RoundedBox
                stroke #33691e
            }
            element "Infra Service" {
                background #fafafa
                color #000000
                shape RoundedBox
                stroke #616161
            }
            element "Repository" {
                shape Cylinder
                background #eceff1
                color #000000
                stroke #616161
            }
            element "Use Case" {
                shape Ellipse
                background #e0f7fa
                stroke #006064
                color #000000
            }

            # External
            element "External System" {
                background #ffebee
                color #b71c1c
                stroke #b71c1c
            }
            
            # --- GROUPS (Thick Borders & Matching Colors) ---
            
            # Default Group Style
            element "Group" {
                color #757575
                strokeWidth 10
            }

            # Client Side Groups (Blueish Borders)
            element "Group:Routing & Shell" {
                color #42a5f5
                stroke #42a5f5
            }
            element "Group:State Stores" {
                color #ffa726
                stroke #ffa726
            }
            element "Group:Pages" {
                color #ef5350
                stroke #ef5350
            }
            element "Group:UI Layout Containers" {
                color #29b6f6
                stroke #29b6f6
            }
            element "Group:Client Infrastructure" {
                color #78909c
                stroke #78909c
            }

            # Server Side Groups (Purpleish Borders)
            element "Group:API Layer" {
                color #ab47bc
                stroke #ab47bc
            }
            element "Group:Application Services" {
                color #66bb6a
                stroke #66bb6a
            }
            element "Group:Core Domain" {
                color #26c6da
                stroke #26c6da
            }
            element "Group:Infrastructure Layer" {
                color #8d6e63
                stroke #8d6e63
            }
        }
    }
}