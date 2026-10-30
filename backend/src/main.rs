use cone_backend::{AppState, Config, router, run_market};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cone_backend=info,tower_http=info".into()),
        )
        .init();
    let config = Config::from_env().map_err(|e| std::io::Error::other(e.1))?;
    let local_admin = std::env::var("CONE_LOCAL_ADMIN").as_deref() == Ok("true");
    if local_admin
        && !config
            .bind
            .parse::<std::net::SocketAddr>()?
            .ip()
            .is_loopback()
    {
        return Err(
            std::io::Error::other("CONE_LOCAL_ADMIN requires a loopback bind address").into(),
        );
    }
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    tracing::info!(address=%listener.local_addr()?,database=%config.database.display(),"CONE backend starting");
    let state = AppState::open(config).map_err(|e| std::io::Error::other(e.1))?;
    if local_admin {
        state
            .store
            .ensure_initial_user(
                &std::env::var("CONE_INITIAL_USERNAME").unwrap_or_default(),
                &std::env::var("CONE_INITIAL_PASSWORD").unwrap_or_default(),
            )
            .map_err(|e| std::io::Error::other(e.1))?;
    }
    let app = router(state.clone()).map_err(|e| std::io::Error::other(e.1))?;
    let market = tokio::spawn(run_market(state));
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    market.abort();
    Ok(())
}
