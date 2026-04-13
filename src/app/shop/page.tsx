"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/db";

interface ProductType {
  id: string;
  name: string;
}

interface Product {
  id: string;
  productTypeId: string;
  name: string;
  defaultUnit: string;
  productType?: ProductType;
}

interface Price {
  id: string;
  productId: string;
  market: string;
  price: number;
  volume: number;
}

interface ProductWithPrices extends Product {
  prices: Price[];
  productType?: ProductType;
}

interface ShopItem {
  id: string;
  name: string;
  matchedProducts: ProductWithPrices[];
  isUnknown: boolean;
  checked: boolean;
}

interface MarketResult {
  market: string;
  total: number;
  items: {
    itemName: string;
    productName: string;
    price: number;
    volume: number;
    unit: string;
    perUnit: number;
    isBest: boolean;
  }[];
  isRecommended: boolean;
}

const STORAGE_KEY = "aus-shopping-list";

export default function ShopPage() {
  const [inputText, setInputText] = useState("");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    loadFromStorage();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: productsRes } = await supabase.from("Product").select(`
      *,
      productType:ProductType(*),
      prices:Price(*)
    `);
    if (productsRes) setProducts(productsRes as unknown as ProductWithPrices[]);
    setLoading(false);
  };

  const loadFromStorage = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setShopItems(parsed.items || []);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const saveToStorage = (items: ShopItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  };

  useEffect(() => {
    if (!loading) {
      saveToStorage(shopItems);
    }
  }, [shopItems, loading]);

  const getBestPrice = (product: ProductWithPrices, market: string): Price | null => {
    const marketPrices = product.prices.filter((p) => p.market === market);
    if (marketPrices.length === 0) return null;

    return marketPrices.reduce((best, current) => {
      const bestPerUnit = getPricePerUnit(best.price, best.volume, product.defaultUnit);
      const currentPerUnit = getPricePerUnit(current.price, current.volume, product.defaultUnit);
      return currentPerUnit < bestPerUnit ? current : best;
    });
  };

  const getPricePerUnit = (price: number, volume: number, unit: string): number => {
    if (volume === 0) return 0;
    if (unit === "개") return price / volume;
    if (unit === "L") return price / volume;
    if (unit === "kg") return price / volume;
    return price / (volume / 100);
  };

  const matchProducts = (searchTerm: string): ProductWithPrices[] => {
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.productType?.name.toLowerCase().includes(term)
    );
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && inputText.trim()) {
      e.preventDefault();
      const newItem: ShopItem = {
        id: crypto.randomUUID(),
        name: inputText.trim(),
        matchedProducts: matchProducts(inputText.trim()),
        isUnknown: matchProducts(inputText.trim()).length === 0,
        checked: false,
      };
      setShopItems([...shopItems, newItem]);
      setInputText("");
    }
  };

  const removeItem = (id: string) => {
    setShopItems(shopItems.filter((item) => item.id !== id));
  };

  const toggleCheck = (id: string) => {
    setShopItems(
      shopItems.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const resetAll = () => {
    if (confirm("정말 전체 삭제하시겠습니까?")) {
      setShopItems([]);
    }
  };

  const marketResults: MarketResult[] = useMemo(() => {
    if (shopItems.length === 0 || products.length === 0) return [];

    const allMarkets = [...new Set(products.flatMap((p) => p.prices.map((pr) => pr.market)))];

    const results: MarketResult[] = allMarkets.map((market) => {
      const items: MarketResult["items"] = [];
      let hasValidPrice = false;

      shopItems.forEach((shopItem) => {
        if (shopItem.isUnknown) return;

        const matchedProduct = shopItem.matchedProducts[0];
        if (!matchedProduct) return;

        const bestPrice = getBestPrice(matchedProduct, market);
        if (bestPrice) {
          hasValidPrice = true;
          items.push({
            itemName: shopItem.name,
            productName: matchedProduct.name,
            price: bestPrice.price,
            volume: bestPrice.volume,
            unit: matchedProduct.defaultUnit,
            perUnit: getPricePerUnit(bestPrice.price, bestPrice.volume, matchedProduct.defaultUnit),
            isBest: false,
          });
        }
      });

      if (!hasValidPrice) return null;

      const lowestPerUnit = Math.min(...items.map((i) => i.perUnit));
      items.forEach((item) => {
        item.isBest = item.perUnit === lowestPerUnit;
      });

      return {
        market,
        total: items.reduce((sum, item) => sum + item.price, 0),
        items,
        isRecommended: false,
      };
    }).filter((r): r is MarketResult => r !== null);

    results.sort((a, b) => a.total - b.total);
    if (results.length > 0) {
      results[0].isRecommended = true;
    }

    return results;
  }, [shopItems, products]);

  const getPerUnitLabel = (unit: string): string => {
    if (unit === "개") return "1개당";
    if (unit === "L") return "1L당";
    if (unit === "kg") return "1kg당";
    return `100${unit}당`;
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">쇼핑리스트 입력</h2>
        <p className="text-xs text-gray-500 mb-3">제품명 입력 후 Enter</p>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="우유&#10;빵&#10;사과"
          className="w-full h-32 p-3 border rounded-md resize-y text-sm"
        />
      </div>

      {shopItems.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              입력된 아이템 ({shopItems.length})
            </h2>
            <button
              onClick={resetAll}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {shopItems.map((item) => (
              <span
                key={item.id}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  item.isUnknown
                    ? "bg-gray-100 text-gray-500"
                    : item.checked
                    ? "bg-green-50 text-green-700 line-through opacity-60"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {item.isUnknown ? "❓" : "✓"} {item.name}
                <button
                  onClick={() => removeItem(item.id)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {marketResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">마켓별 추천</h2>
          <div className="space-y-4">
            {marketResults.map((result, index) => (
              <div
                key={result.market}
                className={`p-4 rounded-lg border ${
                  result.isRecommended
                    ? "bg-green-50 border-green-300"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {result.isRecommended && (
                      <span className="text-lg">📍</span>
                    )}
                    {index === 1 && !result.isRecommended && (
                      <span className="text-lg">🥈</span>
                    )}
                    {index === 2 && !result.isRecommended && (
                      <span className="text-lg">🥉</span>
                    )}
                    <h3 className="font-semibold">{result.market}</h3>
                    {result.isRecommended && (
                      <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                        추천
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">${result.total.toFixed(2)}</p>
                    {!result.isRecommended && marketResults[0] && (
                      <p className="text-xs text-gray-500">
                        +${(result.total - marketResults[0].total).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {result.items.map((item, i) => (
                    <div
                      key={i}
                      className={`flex justify-between ${
                        item.isBest ? "text-green-700 font-medium" : ""
                      }`}
                    >
                      <span>
                        {item.itemName}
                        {item.isBest && <span className="ml-1 text-green-600">✓</span>}
                      </span>
                      <span>
                        ${item.price.toFixed(2)} ({item.volume}{item.unit})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shopItems.filter((i) => !i.isUnknown).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">쇼핑리스트</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {shopItems
              .filter((item) => !item.isUnknown)
              .map((item) => {
                const product = item.matchedProducts[0];
                const bestMarket = product
                  ? marketResults.find((r) =>
                      r.items.some(
                        (i) =>
                          i.itemName === item.name &&
                          i.productName === product.name &&
                          i.isBest
                      )
                    )
                  : null;

                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      item.checked
                        ? "bg-gray-50 border-gray-200 line-through opacity-60"
                        : "hover:bg-gray-50 border-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleCheck(item.id)}
                      className="w-5 h-5 rounded accent-green-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      {bestMarket && (
                        <p className="text-xs text-green-600">
                          {bestMarket.market}에서 가장 저렴
                        </p>
                      )}
                    </div>
                    {item.checked && (
                      <span className="text-green-600 text-sm">구매 완료</span>
                    )}
                  </label>
                );
              })}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              체크된 아이템: {shopItems.filter((i) => i.checked).length} / {shopItems.filter((i) => !i.isUnknown).length}
            </p>
          </div>
        </div>
      )}

      {shopItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">쇼핑리스트가 비어있습니다</p>
          <p className="text-sm">제품명을 입력하고 Enter를 눌러 추가하세요</p>
        </div>
      )}
    </div>
  );
}
