workspace "Memorise UI Current Architecture" "Current messy architecture with layer violations" {

    model {
        externalApi = softwareSystem "External APIs" "External ML and translation APIs (Segmentation, Classification, NER, Translation)" "External System"
        
        system = softwareSystem "Memorise UI" "React-based annotation platform" {
            webApp = container "Web Application" "The React frontend" "TypeScript/React" {
                
                # PRESENTATION LAYER
                appOrchestrator = component "App Orchestrator" "Top-level app orchestrator. Manages routing, authentication, workspace auto-save, theme, sidebar. Problems: Creates setWorkspaces wrapper, Duplicate save mechanism." "React Component"
                presentationWorkspaceStore = component "WorkspaceStore" "Zustand store for workspaces. Problems: Updated directly from hooks, No validation." "State Store"
                presentationSidebar = component "BubbleSidebar" "Sidebar navigation component" "React Component"
                presentationNotification = component "NotificationSnackbar" "Notification display component" "React Component"
                
                # PAGE COMPONENTS
                loginPage = component "LoginPage" "User authentication page" "React Component"
                workspacePage = component "WorkspacePage" "Workspace editing page (thin wrapper)" "React Component"
                manageWorkspacesPage = component "ManageWorkspacesPage" "Workspace management page" "React Component"
                accountPage = component "AccountPage" "User account management page" "React Component"
                
                # CONTAINER COMPONENTS
                presentationContainer = component "WorkspaceContainer" "Main container component. Problems: 1600+ lines, Contains business logic." "React Component"
                presentationHooks = component "Business Logic Hooks" "Custom React hooks. Problems: Business logic in presentation, Direct API calls." "React Hooks"
                presentationEditorHooks = component "Editor UI Hooks" "Editor-specific hooks. Status: ✅ Correctly placed (UI logic only)." "React Hooks"
                
                # APPLICATION LAYER
                applicationWorkspaceService = component "WorkspaceApplicationService" "Workspace operations. Problems: Only used for CRUD, Bypassed by hooks." "Application Service"
                
                # CORE LAYER
                coreWorkspaceUseCases = component "Workspace Use Cases" "Workspace business logic. Status: ✅ Correctly used." "Use Cases"
                coreAnnotationUseCases = component "Annotation Use Cases" "Annotation business logic. Problems: Bypassed by hooks." "Use Cases"
                coreTagUseCases = component "Tag Use Cases" "Tag business logic. Problems: Bypassed by hooks." "Use Cases"
                coreDomainServices = component "Domain Services" "Pure business logic services. Status: ✅ Correctly defined." "Domain Services"
                coreEntities = component "Domain Entities" "Business entities. Status: ✅ Correctly defined." "Domain Models"
                
                # INFRASTRUCTURE LAYER
                infrastructureRepository = component "WorkspaceRepository" "Persistence. Status: ✅ Correctly used via Application Service." "Repository"
                infrastructureApiServices = component "API Services" "External API integration. Problems: Called directly from hooks." "Infrastructure Services"
                infrastructureThesaurus = component "Thesaurus Infrastructure" "Thesaurus data access. Problems: Business logic in infrastructure layer." "Infrastructure"
                infrastructureLocalStorage = component "LocalStorage" "Browser localStorage API. Used by repositories for persistence." "Browser Storage"

                # RELATIONSHIPS - CORRECT ONES
                appOrchestrator -> applicationWorkspaceService "Uses for workspace CRUD and auto-save" "✅"
                appOrchestrator -> presentationWorkspaceStore "Manages workspace state" "✅"
                appOrchestrator -> presentationSidebar "Renders sidebar navigation" "✅"
                appOrchestrator -> presentationNotification "Renders notifications" "✅"
                appOrchestrator -> loginPage "Routes to login page" "✅"
                appOrchestrator -> workspacePage "Routes to workspace page" "✅"
                appOrchestrator -> manageWorkspacesPage "Routes to manage workspaces page" "✅"
                appOrchestrator -> accountPage "Routes to account page" "✅"
                workspacePage -> presentationContainer "Delegates to container" "✅"
                applicationWorkspaceService -> coreWorkspaceUseCases "Orchestrates" "✅"
                coreWorkspaceUseCases -> infrastructureRepository "Persists" "✅"
                infrastructureRepository -> infrastructureLocalStorage "Reads/writes data" "✅"
                presentationWorkspaceStore -> applicationWorkspaceService "Uses for workspace operations" "✅"
                
                # RELATIONSHIPS - LAYER VIOLATIONS
                presentationHooks -> infrastructureApiServices "Direct API calls (useAnnotationManager, useTranslationManager, useSemanticTags)" "❌"
                presentationHooks -> presentationWorkspaceStore "Direct mutations" "❌"
                presentationContainer -> presentationWorkspaceStore "Direct mutations" "❌"
                presentationContainer -> infrastructureApiServices "Direct SegmentationApiService instantiation" "❌"
                
                # RELATIONSHIPS - INFRASTRUCTURE TO EXTERNAL
                infrastructureApiServices -> externalApi "Calls external APIs (Segmentation, Classification, NER, Translation)" "✅"
                
                # RELATIONSHIPS - PROBLEMATIC BUT EXIST
                presentationHooks -> presentationContainer "State synchronization" "⚠️"
                presentationContainer -> presentationHooks "Uses hooks for business logic" "⚠️"
                presentationHooks -> presentationWorkspaceStore "Multiple save mechanisms" "⚠️"
                appOrchestrator -> presentationWorkspaceStore "Multiple save mechanisms" "⚠️"
            }
        }
    }

    views {
        component webApp "currentArchitecture" {
            include *
            autoLayout lr
            title "Current Architecture - Layer Violations"
        }

        styles {
            element "React Component" {
                background #e1f5ff
            }
            element "State Store" {
                background #fff4e1
            }
            element "Application Service" {
                background #e8f5e9
            }
            element "Use Cases" {
                background #f3e5f5
            }
            element "Domain Services" {
                background #f3e5f5
            }
            element "Domain Models" {
                background #f3e5f5
            }
            element "Repository" {
                background #fff9c4
            }
            element "Infrastructure Services" {
                background #fff9c4
            }
            element "Browser Storage" {
                background #fff9c4
            }
            element "External System" {
                background #ffebee
            }
            
            relationship "✅" {
                color #4caf50
            }
            relationship "❌" {
                color #f44336
                thickness 3
            }
            relationship "⚠️" {
                color #ff9800
            }
        }
    }
}
