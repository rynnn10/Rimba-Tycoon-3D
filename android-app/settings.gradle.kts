// Rimba Tycoon 3D — Android project settings — v1.0.0
// Update terakhir: Jumat, 24/07/2026 11:15 WIB
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "RimbaTycoon"
include(":app")
