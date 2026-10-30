use cone_engine::{Engine, EngineError, MarketOrder, Money, Product, Quote, Side};
use std::collections::BTreeMap;

fn money(minor: i64) -> Money {
    Money::from_minor(minor)
}
fn engine() -> Engine {
    Engine::new(money(10_000_000)).unwrap()
}
fn order(id: &str, side: Side, product: Product, quantity: u32) -> MarketOrder {
    MarketOrder {
        id: id.into(),
        instrument: "NSE_EQ|TEST".into(),
        side,
        product,
        quantity,
    }
}
fn quote(price: i64) -> Quote {
    Quote {
        instrument: "NSE_EQ|TEST".into(),
        price: money(price),
        timestamp_ms: 1_000,
    }
}
fn fill(
    e: &mut Engine,
    id: &str,
    side: Side,
    product: Product,
    quantity: u32,
    price: i64,
) -> cone_engine::Execution {
    e.execute_market(order(id, side, product, quantity), &quote(price), 1_000)
        .unwrap()
}

#[test]
fn delivery_buy_partial_sell_and_full_close_conserve_basis() {
    let mut e = engine();
    fill(&mut e, "1", Side::Buy, Product::Cnc, 3, 100);
    fill(&mut e, "2", Side::Buy, Product::Cnc, 2, 101);
    assert_eq!(e.account().holdings()["NSE_EQ|TEST"].cost_basis, money(502));
    assert_eq!(
        fill(&mut e, "3", Side::Sell, Product::Cnc, 1, 120).realized_pnl,
        money(20)
    );
    assert_eq!(
        fill(&mut e, "4", Side::Sell, Product::Cnc, 4, 120).realized_pnl,
        money(78)
    );
    assert!(e.account().holdings().is_empty());
    assert_eq!(e.account().available_cash(), money(10_000_098));
    assert_eq!(e.account().realized_pnl(), money(98));
}

#[test]
fn delivery_cannot_short_or_spend_unavailable_cash() {
    let mut e = engine();
    let before = e.account().clone();
    assert_eq!(
        e.execute_market(order("1", Side::Sell, Product::Cnc, 1), &quote(100), 1_000),
        Err(EngineError::InsufficientHoldings)
    );
    assert_eq!(
        e.execute_market(
            order("2", Side::Buy, Product::Cnc, 1001),
            &quote(10_000),
            1_000
        ),
        Err(EngineError::InsufficientFunds)
    );
    assert_eq!(e.account(), &before);
    assert!(e.executions().is_empty());
}

#[test]
fn long_mis_releases_margin_and_realizes_profit_after_fees() {
    let mut e = engine();
    let open = fill(&mut e, "1", Side::Buy, Product::Mis, 10, 10_000);
    assert_eq!(open.fee, money(30));
    assert_eq!(e.account().used_margin(), money(20_000));
    let close = fill(&mut e, "2", Side::Sell, Product::Mis, 10, 11_000);
    assert_eq!(close.realized_pnl, money(9_967));
    assert_eq!(e.account().available_cash(), money(10_009_937));
    assert_eq!(e.account().realized_pnl(), money(9_937));
    assert_eq!(e.account().used_margin(), Money::ZERO);
    assert!(e.account().positions().is_empty());
}

#[test]
fn short_cover_returns_margin_and_profit_without_sale_proceeds() {
    let mut e = engine();
    fill(&mut e, "1", Side::Sell, Product::Mis, 10, 10_000);
    assert_eq!(e.account().available_cash(), money(9_979_970));
    fill(&mut e, "2", Side::Buy, Product::Mis, 10, 9_000);
    assert_eq!(e.account().available_cash(), money(10_009_943));
    assert_eq!(e.account().used_margin(), Money::ZERO);
    assert!(e.account().positions().is_empty());
}

#[test]
fn repeated_short_orders_merge_and_partial_cover_preserves_basis() {
    let mut e = engine();
    fill(&mut e, "1", Side::Sell, Product::Mis, 3, 101);
    fill(&mut e, "2", Side::Sell, Product::Mis, 2, 103);
    assert_eq!(
        e.account().positions()["NSE_EQ|TEST"].entry_value,
        money(509)
    );
    fill(&mut e, "3", Side::Buy, Product::Mis, 2, 90);
    let p = &e.account().positions()["NSE_EQ|TEST"];
    assert_eq!(p.quantity, 3);
    assert_eq!(p.entry_value, money(306));
    fill(&mut e, "4", Side::Buy, Product::Mis, 3, 90);
    assert_eq!(e.account().used_margin(), Money::ZERO);
    assert_eq!(e.account().available_cash(), money(10_000_059));
}

#[test]
fn crossing_zero_closes_old_position_and_opens_remaining_quantity() {
    let mut e = engine();
    fill(&mut e, "1", Side::Buy, Product::Mis, 5, 10_000);
    let reversed = fill(&mut e, "2", Side::Sell, Product::Mis, 8, 11_000);
    let p = &e.account().positions()["NSE_EQ|TEST"];
    assert_eq!((p.side, p.quantity), (Side::Sell, 3));
    assert_eq!(p.entry_value, money(33_000));
    assert_eq!(p.margin, money(6_600));
    assert_eq!(reversed.realized_pnl, money(4_974));
    assert_eq!(e.account().used_margin(), money(6_600));
}

#[test]
fn rejected_reversal_leaves_entire_account_unchanged() {
    let mut e = Engine::new(money(2_100)).unwrap();
    fill(&mut e, "1", Side::Buy, Product::Mis, 1, 10_000);
    let before = e.account().clone();
    assert_eq!(
        e.execute_market(
            order("2", Side::Sell, Product::Mis, 100),
            &quote(10_000),
            1_000
        ),
        Err(EngineError::InsufficientFunds)
    );
    assert_eq!(e.account(), &before);
    assert_eq!(e.executions().len(), 1);
}

#[test]
fn fees_are_included_in_funding_check() {
    let mut e = Engine::new(money(2_000)).unwrap();
    assert_eq!(
        e.execute_market(
            order("1", Side::Buy, Product::Mis, 1),
            &quote(10_000),
            1_000
        ),
        Err(EngineError::InsufficientFunds)
    );
    assert!(e.account().positions().is_empty());
}

#[test]
fn losing_position_can_close_even_if_it_creates_debt() {
    let mut e = Engine::new(money(100_000)).unwrap();
    fill(&mut e, "1", Side::Sell, Product::Mis, 10, 10_000);
    fill(&mut e, "2", Side::Buy, Product::Mis, 10, 100_000);
    assert_eq!(e.account().available_cash(), money(-800_330));
    assert!(e.account().positions().is_empty());
    assert_eq!(e.account().used_margin(), Money::ZERO);
    assert_eq!(
        e.execute_market(order("3", Side::Buy, Product::Mis, 1), &quote(100), 1_000),
        Err(EngineError::InsufficientFunds)
    );
}

#[test]
fn retries_are_idempotent_and_conflicting_ids_are_rejected() {
    let mut e = engine();
    let request = order("1", Side::Buy, Product::Cnc, 2);
    let first = e
        .execute_market(request.clone(), &quote(100), 1_000)
        .unwrap();
    let before = e.account().clone();
    assert_eq!(
        e.execute_market(request, &quote(999), 99_000).unwrap(),
        first
    );
    assert_eq!(e.account(), &before);
    assert_eq!(e.executions().len(), 1);
    assert_eq!(
        e.execute_market(order("1", Side::Buy, Product::Cnc, 3), &quote(100), 1_000),
        Err(EngineError::DuplicateOrderId)
    );
}

#[test]
fn malformed_stale_future_and_mismatched_quotes_are_rejected() {
    let mut e = engine();
    let request = order("1", Side::Buy, Product::Cnc, 1);
    assert_eq!(
        e.execute_market(request.clone(), &quote(100), 6_001),
        Err(EngineError::StaleQuote)
    );
    assert_eq!(
        e.execute_market(request.clone(), &quote(100), 999),
        Err(EngineError::QuoteInFuture)
    );
    assert_eq!(
        e.execute_market(request.clone(), &quote(0), 1_000),
        Err(EngineError::InvalidQuote)
    );
    assert_eq!(
        e.execute_market(request.clone(), &quote(-1), 1_000),
        Err(EngineError::InvalidQuote)
    );
    let wrong = Quote {
        instrument: "OTHER".into(),
        ..quote(100)
    };
    assert_eq!(
        e.execute_market(request, &wrong, 1_000),
        Err(EngineError::InstrumentMismatch)
    );
    assert_eq!(
        e.execute_market(order("", Side::Buy, Product::Cnc, 1), &quote(100), 1_000),
        Err(EngineError::InvalidOrder)
    );
    assert_eq!(
        e.execute_market(order("1", Side::Buy, Product::Cnc, 0), &quote(100), 1_000),
        Err(EngineError::InvalidOrder)
    );
    assert!(e.executions().is_empty());
}

#[test]
fn overflow_never_wraps_or_changes_account() {
    let mut e = engine();
    let before = e.account().clone();
    assert_eq!(
        e.execute_market(
            order("1", Side::Buy, Product::Cnc, 2),
            &quote(i64::MAX),
            1_000
        ),
        Err(EngineError::Overflow)
    );
    assert_eq!(e.account(), &before);
    assert!(e.executions().is_empty());
}

#[test]
fn equity_values_holdings_and_long_and_short_positions_correctly() {
    for side in [Side::Buy, Side::Sell] {
        let mut e = engine();
        fill(&mut e, "1", Side::Buy, Product::Cnc, 2, 10_000);
        fill(&mut e, "2", side, Product::Mis, 10, 10_000);
        let prices = BTreeMap::from([("NSE_EQ|TEST".into(), money(11_000))]);
        let expected = if side == Side::Buy {
            10_011_970
        } else {
            9_991_970
        };
        assert_eq!(e.account().equity(&prices).unwrap(), money(expected));
        assert!(matches!(
            e.account().equity(&BTreeMap::new()),
            Err(EngineError::MissingPrice(_))
        ));
    }
}

#[test]
fn rounding_does_not_leak_margin_across_partial_closes() {
    for side in [Side::Buy, Side::Sell] {
        for price in [1, 2, 3, 11, 101, 10_000] {
            for qty in [1, 2, 7] {
                let mut e = engine();
                let opened = fill(&mut e, "open", side, Product::Mis, qty, price);
                let close_side = if side == Side::Buy {
                    Side::Sell
                } else {
                    Side::Buy
                };
                let mut fees = opened.fee.minor();
                for n in 0..qty {
                    fees += fill(
                        &mut e,
                        &format!("close-{n}"),
                        close_side,
                        Product::Mis,
                        1,
                        price,
                    )
                    .fee
                    .minor();
                }
                assert_eq!(e.account().used_margin(), Money::ZERO);
                assert!(e.account().positions().is_empty());
                assert_eq!(e.account().available_cash(), money(10_000_000 - fees));
            }
        }
    }
}

#[test]
fn separate_engines_isolate_accounts_and_order_ids() {
    let mut first = engine();
    let second = engine();
    fill(&mut first, "1", Side::Buy, Product::Cnc, 1, 100);
    assert_eq!(second.account().available_cash(), money(10_000_000));
    assert!(second.executions().is_empty());
}

#[test]
fn fee_cap_and_formatting_boundaries() {
    let mut e = engine();
    assert_eq!(
        fill(&mut e, "1", Side::Buy, Product::Mis, 1, 10_000_000).fee,
        money(2_000)
    );
    assert_eq!(money(i64::MIN).to_string(), "-C 92233720368547758.08");
    assert!(matches!(
        Engine::new(money(-1)),
        Err(EngineError::InvalidOpeningBalance)
    ));
}

#[test]
fn reservations_conserve_equity_and_failed_releases_are_atomic() {
    let mut e = engine();
    e.reserve(money(12345)).unwrap();
    assert_eq!(e.account().available_cash(), money(9_987_655));
    assert_eq!(e.account().reserved_cash(), money(12_345));
    assert_eq!(
        e.account().equity(&BTreeMap::new()).unwrap(),
        money(10_000_000)
    );
    let before = e.account().clone();
    assert!(e.release(money(12_346)).is_err());
    assert_eq!(e.account(), &before);
    assert!(e.reserve(money(-1)).is_err());
    assert_eq!(e.account(), &before);
    e.release(money(12345)).unwrap();
    assert_eq!(e.account().available_cash(), money(10_000_000));
}

#[test]
fn weekday_indian_session_boundaries_and_weekend() {
    use cone_engine::{Session, indian_equity_session};
    // 2026-10-29 00:00 UTC, a Thursday.
    let day = 1_793_232_000_000_u64;
    let at = |hour: u64, minute: u64| day + (hour * 60 + minute) * 60_000 - 19_800_000;
    assert_eq!(indian_equity_session(at(9, 14)), Session::Closed);
    assert_eq!(indian_equity_session(at(9, 15)), Session::Open);
    assert_eq!(indian_equity_session(at(15, 19)), Session::Open);
    assert_eq!(indian_equity_session(at(15, 20)), Session::DeliveryOnly);
    assert_eq!(indian_equity_session(at(15, 30)), Session::Closed);
    assert_eq!(
        indian_equity_session(at(10, 0) + 2 * 86_400_000),
        Session::Closed
    );
}
