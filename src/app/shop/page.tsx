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
    market: string;
    isBest: boolean;
  }[];
  isRecommended: boolean;
}

interface ItemRecommendation {
  itemName: string;
  bestMarket: string;
  bestPrice: number;
  volume: number;
  unit: string;
  perUnit: number;
  allPrices: { market: string; price: number; perUnit: number }[];
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
      addItemsFromText(inputText);
    }
  };

  const addItemsFromText = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    const newItems: ShopItem[] = lines.map((line) => {
      const name = line.trim();
      return {
        id: crypto.randomUUID(),
        name,
        matchedProducts: matchProducts(name),
        isUnknown: matchProducts(name).length === 0,
        checked: false,
      };
    });
    setShopItems([...shopItems, ...newItems]);
    setInputText("");
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
            market: market,
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

  const itemRecommendations: ItemRecommendation[] = useMemo(() => {
    if (shopItems.length === 0 || products.length === 0) return [];

    const recommendations: ItemRecommendation[] = [];

    shopItems.forEach((shopItem) => {
      if (shopItem.isUnknown) return;

      const matchedProduct = shopItem.matchedProducts[0];
      if (!matchedProduct) return;

      const allPrices: { market: string; price: number; perUnit: number }[] = [];
      const allMarkets = [...new Set(products.flatMap((p) => p.prices.map((pr) => pr.market)))];

      allMarkets.forEach((market) => {
        const bestPrice = getBestPrice(matchedProduct, market);
        if (bestPrice) {
          allPrices.push({
            market,
            price: bestPrice.price,
            perUnit: getPricePerUnit(bestPrice.price, bestPrice.volume, matchedProduct.defaultUnit),
          });
        }
      });

      if (allPrices.length === 0) return;

      allPrices.sort((a, b) => a.perUnit - b.perUnit);
      const best = allPrices[0];

      recommendations.push({
        itemName: shopItem.name,
        bestMarket: best.market,
        bestPrice: best.price,
        volume: matchedProduct.prices.find(p => p.market === best.market && p.price === best.price)?.volume || 0,
        unit: matchedProduct.defaultUnit,
        perUnit: best.perUnit,
        allPrices,
      });
    });

    return recommendations;
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
        <p className="text-xs text-gray-500 mb-3">줄바꿈으로 제품명 구분</p>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="우유&#10;빵&#10;사과"
          className="w-full h-32 p-3 border rounded-md resize-y text-sm"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => addItemsFromText(inputText)}
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            쇼핑 추천
          </button>
          <button
            onClick={() => {
              setInputText("");
              setShopItems([]);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            초기화
          </button>
        </div>
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
                {item.isUnknown ? "❓" : ""} {item.name}
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

      {itemRecommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">쇼핑리스트</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(() => {
              const groupedByMarket = itemRecommendations.reduce((acc, rec) => {
                if (!acc[rec.bestMarket]) acc[rec.bestMarket] = [];
                const item = shopItems.find((i) => i.name === rec.itemName);
                if (item) acc[rec.bestMarket].push({ ...item, rec });
                return acc;
              }, {} as Record<string, (ShopItem & { rec: ItemRecommendation })[]>);

              return Object.entries(groupedByMarket)
                .sort()
                .map(([market, items]) => (
                  <div key={market} className="border-b last:border-0 pb-4 last:pb-0 mb-4 last:mb-0">
                    <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      {market}
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => (
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
                            {!item.checked && item.rec && (
                              <p className="text-xs text-gray-500">
                                ${item.rec.bestPrice.toFixed(2)} ({item.rec.volume}{item.rec.unit}) - 100{item.rec.unit}당 ${item.rec.perUnit.toFixed(2)}
                              </p>
                            )}
                          </div>
                          {item.checked && (
                            <span className="text-green-600 text-sm">구매 완료</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ));
            })()}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              체크된 아이템: {shopItems.filter((i) => i.checked).length} / {shopItems.filter((i) => !i.isUnknown).length}
            </p>
          </div>
        </div>
      )}

      {itemRecommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">가격 상세</h2>
          <div className="space-y-3">
            {itemRecommendations.map((rec, index) => (
              <div key={index} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-semibold">{rec.bestMarket}</span>
                    <span className="text-gray-400">•</span>
                    <span className="font-medium">{rec.itemName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">${rec.bestPrice.toFixed(2)}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({rec.volume}{rec.unit})
                    </span>
                  </div>
                </div>
                {rec.allPrices.length > 1 && (
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    {rec.allPrices.slice(1).map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{p.market}</span>
                        <span>${p.price.toFixed(2)} (100{rec.unit}당 ${p.perUnit.toFixed(2)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {shopItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">쇼핑리스트가 비어있습니다</p>
          <p className="text-sm">제품명을 입력하고 파싱 버튼을 눌러주세요</p>
        </div>
      )}

      {marketResults.length === 0 && shopItems.filter((i) => !i.isUnknown).length === 0 && shopItems.filter((i) => i.isUnknown).length > 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">일치하는 제품이 없습니다</p>
          <p className="text-sm">다른 제품명으로 시도해주세요</p>
        </div>
      )}
    </div>
  );
}
