from argostranslate import package


LANGUAGE_PAIRS = (("en", "zh"), ("en", "ko"), ("en", "ja"))


package.update_package_index()
available = package.get_available_packages()

for source, target in LANGUAGE_PAIRS:
    model = next(
        (
            candidate
            for candidate in available
            if candidate.from_code == source and candidate.to_code == target
        ),
        None,
    )
    if model is None:
        raise RuntimeError(f"No Argos model is available for {source}->{target}")
    path = model.download()
    package.install_from_path(path)
    print(f"Installed {source}->{target}", flush=True)
