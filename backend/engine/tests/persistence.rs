// Persistence is a host responsibility. The serde representation preserves the
// complete account including successful IDs, so retries survive a host restart.
use cone_engine::{Engine, MarketOrder, Money, Product, Quote, Side};

#[test]
fn snapshot_round_trip_preserves_idempotency_and_reservations() {
    let mut engine = Engine::new(Money::from_minor(10_000_000)).unwrap();
    let order = MarketOrder {
        id: "persist".into(),
        instrument: "TEST".into(),
        side: Side::Buy,
        product: Product::Mis,
        quantity: 3,
    };
    let quote = Quote {
        instrument: "TEST".into(),
        price: Money::from_minor(101),
        timestamp_ms: 1000,
    };
    let fill = engine.execute_market(order.clone(), &quote, 1000).unwrap();
    engine.reserve(Money::from_minor(51)).unwrap();
    let bytes = serde_json::to_vec(&engine).unwrap();
    let mut restored: Engine = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(engine.account(), restored.account());
    assert_eq!(restored.execute_market(order, &quote, 90000).unwrap(), fill);
    assert_eq!(engine.account(), restored.account());
}
