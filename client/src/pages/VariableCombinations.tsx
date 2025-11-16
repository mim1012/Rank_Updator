import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Sparkles, TrendingUp, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function VariableCombinations() {
  const [selectedGeneration, setSelectedGeneration] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  const { data: combinations, isLoading, refetch } = trpc.variableCombinations.list.useQuery({
    generation: selectedGeneration,
    status: selectedStatus as any,
  });

  const { data: generationStats } = trpc.variableCombinations.getGenerationStats.useQuery();

  const generateInitialMutation = trpc.variableCombinations.generateInitial.useMutation({
    onSuccess: (data) => {
      toast.success(`초기 ${data.count}개 조합 생성 완료!`);
      refetch();
    },
    onError: (error) => {
      toast.error(`생성 실패: ${error.message}`);
    },
  });

  const evolveMutation = trpc.variableCombinations.evolve.useMutation({
    onSuccess: (data) => {
      toast.success(`세대 ${data.generation} 생성 완료! (${data.count}개 조합)`);
      refetch();
    },
    onError: (error) => {
      toast.error(`진화 실패: ${error.message}`);
    },
  });

  const deleteMutation = trpc.variableCombinations.delete.useMutation({
    onSuccess: () => {
      toast.success("조합 삭제 완료");
      refetch();
    },
    onError: (error) => {
      toast.error(`삭제 실패: ${error.message}`);
    },
  });

  const handleGenerateInitial = () => {
    if (confirm("L18 직교배열표로 초기 18개 조합을 생성하시겠습니까?")) {
      generateInitialMutation.mutate();
    }
  };

  const handleEvolve = () => {
    const latestGen = generationStats?.[generationStats.length - 1]?.generation ?? 0;
    if (confirm(`세대 ${latestGen + 1}을 진화시키시겠습니까?`)) {
      evolveMutation.mutate({ generation: latestGen, populationSize: 50 });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("이 조합을 삭제하시겠습니까?")) {
      deleteMutation.mutate({ id });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "elite":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "significant":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "testing":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "new":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "deprecated":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      elite: "엘리트",
      significant: "유의미",
      testing: "테스트 중",
      new: "신규",
      deprecated: "폐기",
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">변수 조합 관리</h1>
            <p className="text-gray-500 mt-1">L18 직교배열 + 유전 알고리즘 기반 최적화</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateInitial}
              disabled={generateInitialMutation.isPending}
              variant="outline"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              초기 생성
            </Button>
            <Button
              onClick={handleEvolve}
              disabled={evolveMutation.isPending || !generationStats || generationStats.length === 0}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              다음 세대 진화
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">전체 조합</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{combinations?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">엘리트</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {combinations?.filter(c => c.status === "elite").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">유의미</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {combinations?.filter(c => c.status === "significant").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">최신 세대</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {generationStats?.[generationStats.length - 1]?.generation ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">세대 필터</label>
                <Select
                  value={selectedGeneration?.toString() || "all"}
                  onValueChange={(value) => setSelectedGeneration(value === "all" ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="전체 세대" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 세대</SelectItem>
                    {generationStats?.map((stat) => (
                      <SelectItem key={stat.generation} value={stat.generation.toString()}>
                        세대 {stat.generation} ({stat.count}개)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">상태 필터</label>
                <Select
                  value={selectedStatus || "all"}
                  onValueChange={(value) => setSelectedStatus(value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="전체 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="elite">엘리트</SelectItem>
                    <SelectItem value="significant">유의미</SelectItem>
                    <SelectItem value="testing">테스트 중</SelectItem>
                    <SelectItem value="new">신규</SelectItem>
                    <SelectItem value="deprecated">폐기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  새로고침
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Combinations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combinations?.map((combo) => (
            <Card key={combo.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">세대 {combo.generation}</Badge>
                  <Badge className={getStatusColor(combo.status)}>{getStatusLabel(combo.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 변수 설정 */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">변수 설정</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(combo.variablesParsed).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-500">{key}</div>
                        <div className="font-medium">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 성능 지표 */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">성능 지표</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">성능 점수</span>
                      <span className="font-bold">{combo.score.toFixed(2)}</span>
                    </div>
                    {combo.avgRank && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">평균 순위</span>
                        <span className="font-medium">{combo.avgRank}</span>
                      </div>
                    )}
                    {combo.successRate !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">성공률</span>
                        <span className="font-medium">{(combo.successRate / 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {combo.captchaAvoidRate !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">캡처 회피</span>
                        <span className="font-medium">{(combo.captchaAvoidRate / 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(combo.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {combinations?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">조합이 없습니다</h3>
              <p className="text-gray-500 mb-4">초기 생성 버튼을 눌러 L18 조합을 생성하세요</p>
              <Button onClick={handleGenerateInitial} disabled={generateInitialMutation.isPending}>
                <Sparkles className="w-4 h-4 mr-2" />
                초기 생성 시작
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
