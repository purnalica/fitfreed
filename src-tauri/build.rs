fn main() {
    println!("cargo:rerun-if-env-changed=FITFREED_SOURCE_REVISION");
    println!("cargo:rerun-if-env-changed=FITFREED_SOURCE_TREE_CLEAN");
    println!(
        "cargo:rustc-env=FITFREED_SOURCE_REVISION={}",
        std::env::var("FITFREED_SOURCE_REVISION").unwrap_or_else(|_| "unbound".to_owned())
    );
    println!(
        "cargo:rustc-env=FITFREED_SOURCE_TREE_CLEAN={}",
        std::env::var("FITFREED_SOURCE_TREE_CLEAN").unwrap_or_else(|_| "false".to_owned())
    );
    tauri_build::build()
}
