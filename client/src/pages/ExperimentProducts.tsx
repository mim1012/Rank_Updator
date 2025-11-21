import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ExperimentProducts() {
  const [isCollecting, setIsCollecting] = useState(false);
  const queryClient = useQueryClient();

  // 상품 개수 조회
  const { data: productCount = 0 } = useQuery({
    queryKey: ["experimentProducts", "count"],
    queryFn: async () => {
      const result = await client.experimentProducts.count.query();
      return result;
    },
  });

  // 상품 목록 조회
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["experimentProducts", "list"],
    queryFn: async () => {
      const result = await client.experimentProducts.list.query();
      return result;
    },
  });

  // 상품 수집 뮤테이션
  const collectMutation = useMutation({
    mutationFn: async () => {
      return await client.experimentProducts.collect.mutate({
        keyword: "장난감",
        targetCount: 100,
      });
    },
    onSuccess: () => {
      toast.success("상품 수집 완료!", {
        description: "100개의 상품이 성공적으로 수집되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["experimentProducts"] });
      setIsCollecting(false);
    },
    onError: (error) => {
      toast.error("상품 수집 실패", {
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      });
      setIsCollecting(false);
    },
  });

  const handleCollectProducts = () => {
    setIsCollecting(true);
    toast.info("상품 수집 시작", {
      description: "네이버 쇼핑에서 200위권 상품 100개를 수집합니다. 약 2-3분 소요됩니다.",
      duration: 5000,
    });
    collectMutation.mutate();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold mb-2">실험용 상품 수집</h1>
        <p className="text-muted-foreground">
          100 Work Type 실험을 위한 네이버 쇼핑 200위권 상품 수집
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집된 상품</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount}개</div>
            <p className="text-xs text-muted-foreground">목표: 100개</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집 범위</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">161-260위</div>
            <p className="text-xs text-muted-foreground">5-6페이지</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집 상태</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productCount >= 100 ? (
                <Badge variant="default" className="text-base">
                  완료
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-base">
                  대기
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {productCount >= 100 ? "실험 준비 완료" : "수집 필요"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 수집 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle>상품 수집</CardTitle>
          <CardDescription>
            키워드 "장난감"으로 네이버 쇼핑 200위권 상품 100개를 자동으로 수집합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleCollectProducts}
            disabled={isCollecting || collectMutation.isPending}
            size="lg"
            className="w-full md:w-auto"
          >
            {isCollecting || collectMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                수집 중... (약 2-3분 소요)
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                상품 수집 시작
              </>
            )}
          </Button>

          {productCount > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              현재 {productCount}개의 상품이 수집되어 있습니다. 다시 수집하면 기존 데이터가 삭제됩니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 상품 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>수집된 상품 목록</CardTitle>
          <CardDescription>
            {productCount > 0
              ? `총 ${productCount}개의 상품이 수집되었습니다.`
              : "아직 수집된 상품이 없습니다. 위 버튼을 클릭하여 수집을 시작하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">순위</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead className="w-[120px]">상품 ID</TableHead>
                    <TableHead className="w-[100px]">사용 여부</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.slice(0, 20).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.position}위</TableCell>
                      <TableCell>
                        <div className="max-w-md truncate" title={product.productName}>
                          {product.productName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {product.productId || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell>
                        {product.isUsed === 1 ? (
                          <Badge variant="default">사용됨</Badge>
                        ) : (
                          <Badge variant="secondary">대기</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>수집된 상품이 없습니다.</p>
            </div>
          )}

          {products.length > 20 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              상위 20개만 표시됩니다. 전체 {products.length}개
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
