workspace "Memorise (Simplified System)" "High-level block diagram where components represent architectural layers" {

    model {
        properties {
             "structurizr.groupSeparator" "/"
        }

        # --- ACTORS ---
        user = person "Annotator" "End user"
        admin = person "Administrator" "System configuration"

        # --- EXTERNAL ---
        externalApi = softwareSystem "External ML APIs" "Translation, NER" "External System"
        storage = softwareSystem "Physical Storage" "S3 / SQL / FileSystem" "External System"
        logs = softwareSystem "Log Consumer" "Splunk / Console" "External System"

        system = softwareSystem "Data Curation Tool" "The Platform" {

            # --- SHARED INFRA ---
            database = container "System Database" "Config & Metadata" "SQL Database" "Database"
            worker = container "Thesaurus Worker" "Search Index" "Web Worker" "Web Worker"

            # ============================================================
            # CONTAINER 1: FRONTEND (Client)
            # ============================================================
            webApp = container "Web Application" "React Frontend" "Web Browser" {
                
                # Format: component <name> <description> <technology> <tag>
                
                # Group: Routing & Shell (#42a5f5)
                clientShell = component "App Shell" "Bootstrapping, Routing, Layouts" "React" "Shell"
                
                # Group: Pages (#ef5350)
                clientPresentation = component "Views & Pages" "Merged Pages, Editors, and UI widgets" "React" "Pages"
                
                # Group: State Stores (#ffa726)
                clientState = component "State Stores" "Redux/Zustand Stores & Queues" "Zustand" "State"
                
                # Group: Client Infrastructure (#78909c)
                clientInfra = component "Client Infrastructure" "ConfigClient, StorageGateway, Adapters" "TypeScript" "ClientInfra"
            }

            # ============================================================
            # CONTAINER 2: BACKEND (Server)
            # ============================================================
            backendApi = container "Backend API" "Node/Go Server" "Server API" {
                
                # Group: API Layer (#ab47bc)
                apiLayer = component "API Controllers" "Endpoints (REST/RPC)" "Go/Node" "ApiLayer"
                
                # Group: Application Services (#66bb6a)
                serviceLayer = component "App Services" "Orchestration & Logic" "Go/Node" "AppServices"
                
                # Group: Core Domain (#26c6da)
                domainLayer = component "Core Domain" "Pure Entities & Use Cases" "Go/Node" "CoreDomain"
                
                # Group: Infrastructure Layer (#8d6e63)
                serverInfra = component "Server Adapters" "Repositories, Engines, External Clients" "Go/Node" "ServerInfra"
            }
        }

        # ============================================================
        # RELATIONSHIPS
        # ============================================================

        # --- Client Internals ---
        user -> clientShell "Loads App"
        clientShell -> clientInfra "Boots (Fetch Config)"
        clientShell -> clientPresentation "Routes to"
        
        clientPresentation -> clientState "Reads / Dispatches"
        clientShell -> clientState "Mounts Sync"
        
        # The Gateway Pattern
        clientState -> clientInfra "Auto-Saves (Gateway)"

        # --- Client -> Backend ---
        clientPresentation -> clientInfra "Requests Export"
        clientInfra -> apiLayer "HTTPS (JSON)"

        # --- Backend Internals ---
        apiLayer -> serviceLayer "Delegates"
        serviceLayer -> domainLayer "Executes"
        serviceLayer -> serverInfra "Uses Adapters"
        domainLayer -> serverInfra "Persists"

        # --- Backend -> External ---
        serverInfra -> externalApi "Calls ML Models"
        serverInfra -> storage "R/W Workspace Data"
        serverInfra -> database "R/W Config"
        serverInfra -> worker "Delegates Search"
        serverInfra -> logs "Emits Errors"
    }

    views {

        # View 1: Context (Actors + Systems)
        systemContext system "SystemContext" {
            include *
            title "Memorise - System Landscape"
            description "High-level overview of Actors and External Systems."
        }
        
        # View 2: Container (High-Level Architecture) [ADDED THIS VIEW]
        container system "SystemContainers" {
            include *
            title "Memorise - Container Architecture"
            description "High-level split: React Client, Backend API, Workers, and DB."
        }

        # View 3: Client Details
        component webApp "ClientMacroView" {
            include *
            include backendApi
            title "Memorise - Client Architecture (Simplified)"
            description "Macro components colored by their architectural group."
        }

        # View 4: Backend Details
        component backendApi "BackendMacroView" {
            include *
            include webApp
            title "Memorise - Backend Architecture (Simplified)"
            description "Macro components colored by their architectural group."
        }

        theme default

        styles {
            # --- GLOBAL SETTINGS ---
            element "Component" {
                shape RoundedBox
                background #ffffff
                color #000000
                stroke #000000
                strokeWidth 2
            }

            # --- SHAPES ---
            element "Person" {
                shape Person
                background #1565c0
                color #ffffff
                stroke #0d47a1
            }
            element "Database" {
                shape Cylinder
                background #eceff1
                color #000000
                stroke #455a64
            }
            element "Web Worker" {
                shape Hexagon
                background #e8f5e9
                color #1b5e20
                stroke #1b5e20
            }
            element "External System" {
                background #ffebee
                color #b71c1c
                stroke #b71c1c
            }
            
            # --- CONTAINERS ---
            element "Web Browser" {
                background #e3f2fd
                color #0d47a1
                stroke #0d47a1
                strokeWidth 2
            }
            element "Server API" {
                background #f3e5f5
                color #4a148c
                stroke #4a148c
                strokeWidth 2
            }

            # --- CLIENT COMPONENT STYLES (Background Colors) ---

            # Group:Routing & Shell
            element "Shell" {
                background #42a5f5
                color #ffffff
            }

            # Group:Pages (Merged with UI Containers)
            element "Pages" {
                background #ef5350
                color #ffffff
            }

            # Group:State Stores
            element "State" {
                background #ffa726
                color #000000
            }

            # Group:Client Infrastructure
            element "ClientInfra" {
                background #78909c
                color #ffffff
            }

            # --- SERVER COMPONENT STYLES (Background Colors) ---

            # Group:API Layer
            element "ApiLayer" {
                background #ab47bc
                color #ffffff
            }

            # Group:Application Services
            element "AppServices" {
                background #66bb6a
                color #000000
            }

            # Group:Core Domain
            element "CoreDomain" {
                background #26c6da
                color #000000
            }

            # Group:Infrastructure Layer
            element "ServerInfra" {
                background #8d6e63
                color #ffffff
            }
        }
    }
}