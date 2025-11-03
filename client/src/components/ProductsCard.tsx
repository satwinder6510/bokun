import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, RefreshCw, PackageOpen } from "lucide-react";
import type { BokunProduct } from "@shared/schema";

interface ProductsCardProps {
  products: BokunProduct[];
  isLoading: boolean;
  onFetch: () => void;
  totalCount?: number;
}

export function ProductsCard({ products, isLoading, onFetch, totalCount }: ProductsCardProps) {
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
                  className="rounded-lg border bg-card p-4 space-y-2 hover-elevate"
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm leading-snug">{product.title}</h4>
                    {product.productCategory && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {product.productCategory}
                      </Badge>
                    )}
                  </div>
                  {product.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {product.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-muted-foreground">
                      ID: {product.id}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border rounded-lg bg-muted/30">
            <PackageOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-sm mb-2">No Products Loaded</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Click the button below to fetch available products from your Bokun account.
            </p>
          </div>
        )}

        <Button
          onClick={onFetch}
          disabled={isLoading}
          variant="outline"
          className="w-full"
          data-testid="button-fetch-products"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Fetching Products...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Products
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
