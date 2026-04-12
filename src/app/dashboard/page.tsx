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

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "red";
}

function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: productsRes } = await supabase.from("Product").select(`
      *,
      productType:ProductType(*),
      prices:Price(*)
    `);
    if (productsRes) setProducts(productsRes as ProductWithPrices[]);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalPrices = products.reduce((acc, p) => acc + p.prices.length, 0);
    const productTypes = [...new Set(products.map((p) => p.productType?.name))].filter(Boolean);

    const marketStats: Record<string, { count: number; avgPricePerUnit: number }> = {};
    const marketPrices: Record<string, number[]> = {};

    products.forEach((product) => {
      product.prices.forEach((price) => {
        if (!marketStats[price.market]) {
          marketStats[price.market] = { count: 0, avgPricePerUnit: 0 };
          marketPrices[price.market] = [];
        }
        marketStats[price.market].count++;

        const volume = price.volume;
        let perUnit = 0;
        if (volume > 0) {
          if (product.defaultUnit === "개") perUnit = price.price / volume;
          else if (product.defaultUnit === "L") perUnit = price.price / volume;
          else if (product.defaultUnit === "kg") perUnit = price.price / volume;
          else perUnit = price.price / (volume / 100);
        }
        marketPrices[price.market].push(perUnit);
      });
    });

    Object.keys(marketStats).forEach((market) => {
      const prices = marketPrices[market];
      if (prices.length > 0) {
        marketStats[market].avgPricePerUnit = prices.reduce((a, b) => a + b, 0) / prices.length;
      }
    });

    const marketRanking = Object.entries(marketStats)
      .sort((a, b) => a[1].avgPricePerUnit - b[1].avgPricePerUnit)
      .map(([market, data], index) => ({
        rank: index + 1,
        market,
        avgPricePerUnit: data.avgPricePerUnit,
        priceCount: data.count,
      }));

    const bestDeals = products
      .filter((p) => p.prices.length > 1)
      .map((product) => {
        const sortedPrices = [...product.prices].sort((a, b) => {
          const getPerUnit = (price: Price, unit: string) => {
            let perUnit = 0;
            const volume = price.volume;
            if (volume > 0) {
              if (unit === "개") perUnit = price.price / volume;
              else if (unit === "L") perUnit = price.price / volume;
              else if (unit === "kg") perUnit = price.price / volume;
              else perUnit = price.price / (volume / 100);
            }
            return perUnit;
          };
          return getPerUnit(a, product.defaultUnit) - getPerUnit(b, product.defaultUnit);
        });
        const best = sortedPrices[0];
        const second = sortedPrices[1];
        if (!second) return null;

        const getPerUnit = (price: Price, unit: string) => {
          let perUnit = 0;
          const volume = price.volume;
          if (volume > 0) {
            if (unit === "개") perUnit = price.price / volume;
            else if (unit === "L") perUnit = price.price / volume;
            else if (unit === "kg") perUnit = price.price / volume;
            else perUnit = price.price / (volume / 100);
          }
          return perUnit;
        };

        return {
          productName: `${product.productType?.name} - ${product.name}`,
          unit: product.defaultUnit,
          best: { market: best.market, price: best.price, perUnit: getPerUnit(best, product.defaultUnit) },
          second: { market: second.market, price: second.price, perUnit: getPerUnit(second, product.defaultUnit) },
          saving: (getPerUnit(second, product.defaultUnit) - getPerUnit(best, product.defaultUnit)),
        };
      })
      .filter((d) => d && d.saving > 0)
      .sort((a, b) => b!.saving - a!.saving)
      .slice(0, 5);

    return {
      totalProducts,
      totalPrices,
      productTypesCount: productTypes.length,
      marketRanking,
      bestDeals,
    };
  }, [products]);

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="총 제품" value={stats.totalProducts} color="blue" />
        <StatCard title="총 가격 기록" value={stats.totalPrices} color="green" />
        <StatCard title="제품 유형" value={stats.productTypesCount} color="yellow" />
        <StatCard title="등록된 마켓" value={stats.marketRanking.length} color="red" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">마켓별 평균 단가 Ranking</h2>
          <p className="text-xs text-gray-500 mb-4">단가 낮을수록 저렴</p>
          <div className="space-y-3">
            {stats.marketRanking.map((rank) => (
              <div key={rank.market} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  rank.rank === 1 ? "bg-green-100 text-green-700" :
                  rank.rank === 2 ? "bg-blue-100 text-blue-700" :
                  rank.rank === 3 ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {rank.rank}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{rank.market}</p>
                  <p className="text-xs text-gray-500">{rank.priceCount}개 가격</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${rank.avgPricePerUnit.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">/단위</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">절약 가능 제품 TOP 5</h2>
          <p className="text-xs text-gray-500 mb-4">2번째 저렴한 마켓 대비 절약액</p>
          <div className="space-y-4">
            {stats.bestDeals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">데이터 부족</p>
            ) : (
              stats.bestDeals.map((deal, index) => (
                <div key={index} className="border-b pb-3 last:border-0">
                  <p className="font-medium text-sm">{deal?.productName}</p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs">
                      <span className="text-green-600 font-medium">{deal?.best.market}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="text-red-600">{deal?.second.market}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">
                        ${deal?.saving.toFixed(2)} 절약
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">마켓별 제품 수</h2>
        <div className="space-y-2">
          {stats.marketRanking.map((rank) => (
            <div key={rank.market} className="flex items-center gap-3">
              <span className="w-24 text-sm font-medium truncate">{rank.market}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    rank.rank === 1 ? "bg-green-500" :
                    rank.rank === 2 ? "bg-blue-500" :
                    rank.rank === 3 ? "bg-yellow-500" :
                    "bg-gray-400"
                  }`}
                  style={{
                    width: `${Math.min(100, (rank.priceCount / Math.max(...stats.marketRanking.map(r => r.priceCount))) * 100)}%`
                  }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{rank.priceCount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
