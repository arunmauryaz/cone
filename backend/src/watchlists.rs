//! Watchlist presentation metadata, independent of trading/accounting.
use crate::error::{ApiError, Result};
use serde_json::{Value, json};
use std::collections::BTreeSet;

pub fn update_metadata(list: &mut Value, request: &Value) -> Result<()> {
    let stocks: BTreeSet<String> = list["stocks"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str().map(str::to_owned))
        .collect();
    let empty = json!([]);
    let groups_value = request
        .get("groups")
        .or_else(|| list.get("groups"))
        .unwrap_or(&empty);
    let groups = groups_value
        .as_array()
        .ok_or_else(|| ApiError::bad("Groups must be an array"))?;
    if groups.len() > 20 {
        return Err(ApiError::bad("Maximum 20 groups per watchlist"));
    }
    let mut ids = BTreeSet::new();
    let mut assigned = BTreeSet::new();
    let mut normalized = Vec::new();
    for group in groups {
        let id = group["id"]
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid group ID"))?;
        if id.is_empty()
            || id.len() > 64
            || !id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
            || !ids.insert(id)
        {
            return Err(ApiError::bad("Invalid or duplicate group ID"));
        }
        let name = group["name"]
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid group name"))?
            .trim();
        if name.is_empty() || name.len() > 50 {
            return Err(ApiError::bad("Group name must be 1–50 bytes"));
        }
        let members = group["stocks"]
            .as_array()
            .ok_or_else(|| ApiError::bad("Group stocks must be an array"))?;
        if members.len() > 100 {
            return Err(ApiError::bad("Maximum 100 instruments per group"));
        }
        let mut retained = Vec::new();
        for item in members {
            let key = item
                .as_str()
                .ok_or_else(|| ApiError::bad("Invalid group instrument"))?;
            if !stocks.contains(key) {
                if request.get("groups").is_some() {
                    return Err(ApiError::bad("Group instrument must be in the watchlist"));
                }
                continue;
            }
            if !assigned.insert(key) {
                return Err(ApiError::bad("An instrument can belong to only one group"));
            }
            retained.push(key);
        }
        normalized.push(json!({"id":id,"name":name,"stocks":retained}));
    }
    let pins_value = request
        .get("pinned")
        .or_else(|| list.get("pinned"))
        .unwrap_or(&empty);
    let pins = pins_value
        .as_array()
        .ok_or_else(|| ApiError::bad("Pinned instruments must be an array"))?;
    if pins.len() > 100 {
        return Err(ApiError::bad("Maximum 100 pinned instruments"));
    }
    let mut seen = BTreeSet::new();
    let mut retained_pins = Vec::new();
    for item in pins {
        let key = item
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid pinned instrument"))?;
        if !stocks.contains(key) {
            if request.get("pinned").is_some() {
                return Err(ApiError::bad("Pinned instrument must be in the watchlist"));
            }
            continue;
        }
        if !seen.insert(key) {
            return Err(ApiError::bad("Duplicate pinned instrument"));
        }
        retained_pins.push(key);
    }
    let pinned = json!(retained_pins);
    let allowed = std::iter::once("")
        .chain(normalized.iter().filter_map(|g| g["id"].as_str()))
        .collect::<BTreeSet<_>>();
    let mut order = Vec::new();
    let mut seen_order = BTreeSet::new();
    if let Some(value) = request.get("groupOrder").or_else(|| list.get("groupOrder")) {
        for key in value
            .as_array()
            .ok_or_else(|| ApiError::bad("Invalid group order"))?
        {
            let key = key
                .as_str()
                .ok_or_else(|| ApiError::bad("Invalid group order"))?;
            if !allowed.contains(key) {
                if request.get("groupOrder").is_some() {
                    return Err(ApiError::bad("Unknown ordered group"));
                }
                continue;
            }
            if !seen_order.insert(key) {
                return Err(ApiError::bad("Duplicate ordered group"));
            }
            order.push(key.to_owned());
        }
    }
    for key in std::iter::once("").chain(normalized.iter().filter_map(|g| g["id"].as_str())) {
        if seen_order.insert(key) {
            order.push(key.to_owned());
        }
    }
    list["groupOrder"] = json!(order);
    list["groups"] = json!(normalized);
    list["pinned"] = pinned;
    Ok(())
}

pub fn move_item(book: &mut crate::model::Book, source_id: &str, req: &Value) -> Result<Value> {
    let source = book
        .watchlists
        .iter()
        .position(|w| w["id"] == source_id)
        .ok_or_else(ApiError::not_found)?;
    let target_id = req["targetListId"]
        .as_str()
        .ok_or_else(|| ApiError::bad("Missing target watchlist"))?;
    let target = book
        .watchlists
        .iter()
        .position(|w| w["id"] == target_id)
        .ok_or_else(ApiError::not_found)?;
    let mut from = book.watchlists[source].clone();
    let mut to = book.watchlists[target].clone();
    update_metadata(&mut from, &json!({}))?;
    update_metadata(&mut to, &json!({}))?;
    let kind = req["kind"].as_str().unwrap_or("stock");
    let item = req["item"]
        .as_str()
        .ok_or_else(|| ApiError::bad("Missing dragged item"))?;
    let before = req["beforeId"].as_str();
    fn insert_before(items: &mut Vec<Value>, item: Value, before: Option<&str>) {
        items.retain(|v| v != &item);
        let index = before
            .and_then(|key| items.iter().position(|v| v == key))
            .unwrap_or(items.len());
        items.insert(index, item);
    }
    if kind == "group" && source == target {
        let mut order = from["groupOrder"].as_array().unwrap().clone();
        if !order.iter().any(|v| v == item) {
            return Err(ApiError::not_found());
        }
        if before != Some(item) {
            insert_before(&mut order, json!(item), before);
            from["groupOrder"] = json!(order);
        }
        book.watchlists[source] = from;
        return Ok(json!({"success":true}));
    }
    let group_id = req["targetGroupId"].as_str().unwrap_or("");
    if !group_id.is_empty()
        && !to["groups"]
            .as_array()
            .unwrap()
            .iter()
            .any(|g| g["id"] == group_id)
    {
        return Err(ApiError::bad("Target group no longer exists"));
    }
    let members = if kind == "stock" {
        if !from["stocks"].as_array().unwrap().iter().any(|v| v == item) {
            return Err(ApiError::not_found());
        }
        vec![json!(item)]
    } else if kind == "group" {
        if item.is_empty() {
            let assigned = from["groups"]
                .as_array()
                .unwrap()
                .iter()
                .flat_map(|g| g["stocks"].as_array().unwrap())
                .collect::<Vec<_>>();
            from["stocks"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|k| !assigned.contains(k))
                .cloned()
                .collect()
        } else {
            from["groups"]
                .as_array()
                .unwrap()
                .iter()
                .find(|g| g["id"] == item)
                .ok_or_else(ApiError::not_found)?["stocks"]
                .as_array()
                .unwrap()
                .clone()
        }
    } else {
        return Err(ApiError::bad("Invalid dragged item type"));
    };
    let pins = from["pinned"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|k| members.contains(k))
        .cloned()
        .collect::<Vec<_>>();
    from["stocks"]
        .as_array_mut()
        .unwrap()
        .retain(|k| !members.contains(k));
    for group in from["groups"].as_array_mut().unwrap() {
        group["stocks"]
            .as_array_mut()
            .unwrap()
            .retain(|k| !members.contains(k));
    }
    if source == target {
        to = from.clone();
    }
    if kind == "group" && !item.is_empty() {
        let moved = book.watchlists[source]["groups"]
            .as_array()
            .unwrap()
            .iter()
            .find(|g| g["id"] == item)
            .unwrap()
            .clone();
        if to["groups"]
            .as_array()
            .unwrap()
            .iter()
            .any(|g| g["id"] == item)
        {
            return Err(ApiError::bad("Target already contains this group"));
        }
        to["groups"].as_array_mut().unwrap().push(moved);
        from["groups"]
            .as_array_mut()
            .unwrap()
            .retain(|g| g["id"] != item);
    }
    for key in &members {
        for group in to["groups"].as_array_mut().unwrap() {
            group["stocks"].as_array_mut().unwrap().retain(|k| k != key);
        }
        insert_before(to["stocks"].as_array_mut().unwrap(), key.clone(), before);
        let destination = if kind == "group" && !item.is_empty() {
            item
        } else {
            group_id
        };
        if let Some(group) = to["groups"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|g| g["id"] == destination)
        {
            insert_before(group["stocks"].as_array_mut().unwrap(), key.clone(), before);
        }
    }
    for key in pins {
        if !to["pinned"].as_array().unwrap().contains(&key) {
            to["pinned"].as_array_mut().unwrap().push(key);
        }
    }
    if to["stocks"].as_array().unwrap().len() > 100 {
        return Err(ApiError::bad("Target watchlist is full"));
    }
    update_metadata(&mut from, &json!({}))?;
    update_metadata(&mut to, &json!({}))?;
    if source != target {
        book.watchlists[source] = from;
    }
    book.watchlists[target] = to;
    Ok(json!({"success":true}))
}
