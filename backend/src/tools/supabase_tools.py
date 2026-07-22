from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams
from loguru import logger

async def query_supabase_data(params: FunctionCallParams):
    """
    Asynchronous callback for Gemini to query Supabase tables and views:
    - shops (vendors)
    - items (inventory products)
    - offers (active deals view)
    - wishlists (customer requests)
    - shop_inventory_by_category (grouped view)
    """
    logger.info(f"Tool query_supabase_data invoked with args: {params.arguments}")

    from src.services.supabase_client import get_supabase_client
    try:
        supabase_client = get_supabase_client()
    except Exception as e:
        error_msg = f"Error: Supabase client is not initialized. Details: {e}"
        logger.error(error_msg)
        await params.result_callback(error_msg)
        return

    table = params.arguments.get("table")
    search_query = params.arguments.get("search_query", "")

    allowed_tables = ["shops", "items", "offers", "wishlists", "shop_inventory_by_category", "item_wishlist_counts"]
    if table not in allowed_tables:
        error_msg = f"Error: Invalid table '{table}'. Allowed tables: {allowed_tables}."
        logger.warning(error_msg)
        await params.result_callback(error_msg)
        return

    try:
        if table == "offers":
            # Query the active_offers_by_shop view which has joins already populated
            query = supabase_client.table("active_offers_by_shop").select("*")
            if search_query:
                query = query.or_(f"item_name.ilike.%{search_query}%,category.ilike.%{search_query}%,shop_name.ilike.%{search_query}%")
        elif table == "items":
            # Query items joined with shops
            query = supabase_client.table("items").select("*, shops(name, location)")
            if search_query:
                query = query.or_(f"name.ilike.%{search_query}%,category.ilike.%{search_query}%")
        elif table == "shops":
            query = supabase_client.table("shops").select("*")
            if search_query:
                query = query.or_(f"name.ilike.%{search_query}%,owner_name.ilike.%{search_query}%")
        elif table == "wishlists":
            query = supabase_client.table("wishlists").select("*, items!inner(name, category, price), profiles(phone)")
            if search_query:
                query = query.ilike("items.name", f"%{search_query}%")
        elif table == "shop_inventory_by_category":
            query = supabase_client.table("shop_inventory_by_category").select("*")
            if search_query:
                query = query.or_(f"shop_name.ilike.%{search_query}%,category.ilike.%{search_query}%")
        elif table == "item_wishlist_counts":
            query = supabase_client.table("item_wishlist_counts").select("*")
            if search_query:
                query = query.or_(f"item_name.ilike.%{search_query}%,shop_name.ilike.%{search_query}%")

        response = query.execute()
        data = response.data

        if not data:
            result = f"No results found in '{table}' matching '{search_query}'."
        else:
            result = f"Database results for {table}: {data}"

        logger.info(f"Database query successful. Results: {data}")
        await params.result_callback(result)

    except Exception as e:
        err_msg = f"Error querying Supabase table '{table}': {str(e)}"
        logger.error(err_msg)
        await params.result_callback(err_msg)

# Define standard FunctionSchema for Google Gemini
supabase_query_schema = FunctionSchema(
    name="query_supabase_data",
    description=(
        "Query the local database tables for vendors, shop inventories, active discount offers, client wishlists, or analytics. "
        "Use 'shops' to search vendor details (names, owners, locations in Hosur). "
        "Use 'items' to search the full standard product inventory catalog across all stores. "
        "Use 'offers' to find active discount deals, sale prices, and discount percentages. "
        "Use 'wishlists' to find details of items clients are looking to buy or their budget. "
        "Use 'shop_inventory_by_category' to see lists of items grouped by categories under each shop. "
        "Use 'item_wishlist_counts' to see a list of items and how many people have added them to their wishlist."
    ),
    properties={
        "table": {
            "type": "string",
            "enum": ["shops", "items", "offers", "wishlists", "shop_inventory_by_category", "item_wishlist_counts"],
            "description": (
                "The database table or view to query: "
                "'shops' for vendor profiles, "
                "'items' for standard product catalog, "
                "'offers' for active discount deals, "
                "'wishlists' for client requests, "
                "'shop_inventory_by_category' for shop inventories grouped by category, "
                "'item_wishlist_counts' for how many users have added items to their wishlist."
            )
        },
        "search_query": {
            "type": "string",
            "description": (
                "Optional keyword to search for (e.g. product names like 'Mixie', "
                "categories like 'Grains', shop names like 'SR Electronics', etc.)"
            )
        }
    },
    required=["table"]
)
