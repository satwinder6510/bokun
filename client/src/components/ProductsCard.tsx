import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, RefreshCw, PackageOpen, Eye } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { BokunProduct } from "@shared/schema";

interface ProductsCardProps {
  products: BokunProduct[];
  isLoading: boolean;
  onProductClick: (productId: string) => void;
  totalCount?: number;
}

export function ProductsCard({ products, isLoading, onProductClick, totalCount }: ProductsCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Available Products
        </CardTitle>
        {totalCount !== undefined && totalCount > 0 && (
          <Badge variant="secondary" className="font-mono text-xs">
            {totalCount} total
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length > 0 ? (
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => onProductClick(product.id)}
                  className="rounded-lg border bg-card p-4 space-y-2 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm leading-snug">{product.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {product.activityCategories && product.activityCategories.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {product.activityCategories[0].replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {product.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {product.excerpt}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs text-muted-foreground">
                      ID: {product.id}
                    </code>
                    {product.price && (
                      <span className="text-xs font-medium text-primary">
                        {siteConfig.currency.symbol}{product.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border rounded-lg bg-muted/30">
            <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4 animate-spin" />
            <h3 className="font-medium text-sm mb-2">Loading Products</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Fetching products from cache or Bokun API...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border rounded-lg bg-muted/30">
            <PackageOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-sm mb-2">No Products Available</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Use "Refresh Products" above to load products from the Bokun API.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
