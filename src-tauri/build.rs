fn main() {
    let public_update_variables = [
        "FITFREED_PUBLIC_UPDATE_CONTRACT",
        "FITFREED_PUBLIC_UPDATE_ENDPOINT",
        "FITFREED_PUBLIC_UPDATE_TRUST",
    ];
    for name in public_update_variables {
        println!("cargo:rerun-if-env-changed={name}");
    }
    let configured_public_update_variables = public_update_variables
        .iter()
        .filter(|name| std::env::var_os(name).is_some())
        .count();
    assert!(
        configured_public_update_variables == 0
            || configured_public_update_variables == public_update_variables.len(),
        "public update build configuration must be absent or complete"
    );
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
