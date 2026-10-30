use cone_engine::{Engine, MarketOrder, Money, Product, Quote, Side};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut engine = Engine::new(Money::from_minor(10_000_000))?;
    for (id, side, price) in [("buy-1", Side::Buy, 10_000), ("sell-1", Side::Sell, 11_000)] {
        let order = MarketOrder {
            id: id.into(),
            instrument: "NSE_EQ|DEMO".into(),
            side,
            product: Product::Mis,
            quantity: 10,
        };
        let quote = Quote {
            instrument: order.instrument.clone(),
            price: Money::from_minor(price),
            timestamp_ms: 1_000,
        };
        let fill = engine.execute_market(order, &quote, 1_000)?;
        println!(
            "{side:?}: price {}, fee {}, realized {}",
            fill.price, fill.fee, fill.realized_pnl
        );
    }
    println!("Available cash: {}", engine.account().available_cash());
    println!("Used margin: {}", engine.account().used_margin());
    Ok(())
}
