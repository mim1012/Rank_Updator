import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Play, RotateCcw, Loader2, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function CampaignDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const campaignId = parseInt(params.id || "0");

  const { data: campaign, isLoading: campaignLoading, refetch: refetchCampaign } =
    trpc.campaigns.get.useQuery({ id: campaignId });

  const { data: stats, refetch: refetchStats } =
    trpc.campaigns.stats.useQuery({ id: campaignId });

  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } =
    trpc.tasks.list.useQuery({ campaignId });

  const executeMutation = trpc.tasks.execute.useMutation({
    onSuccess: (data) => {
      if (data.rank > 0) {
        toast.success(`작업 완료! 순위: ${data.rank}위`);
      } else {
        toast.info("작업 완료 (순위 없음)");
      }
      refetchTasks();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`작업 실패: ${error.message}`);
    },
  });

  const retryMutation = trpc.tasks.retry.useMutation({
    onSuccess: () => {
      toast.success("작업을 재시도 대기열에 추가했습니다");
      refetchTasks();
    },
  });

  const handleExecuteTask = async (taskId: number) => {
    if (!confirm("이 작업을 실행하시겠습니까?")) return;
    executeMutation.mutate({
      id: taskId,
      loginId: "rank2",
      imei: "123456789012345",
      usePuppeteer: false, // HTTP 모드 (Android APK 사용)
    });
  };

  const handleRetry = async (taskId: number) => {
    retryMutation.mutate({ id: taskId });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-gray-100 text-gray-800",
      running: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    const labels = {
      pending: "대기",
      running: "실행 중",
      completed: "완료",
      failed: "실패",
    };
    return (
      <Badge className={variants[status as keyof typeof variants] || ""}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (campaignLoading || tasksLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">캠페인을 찾을 수 없습니다</p>
          <Button onClick={() => setLocation("/campaigns")} className="mt-4">
            캠페인 목록으로
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/campaigns")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            뒤로
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-gray-500 mt-1">
              키워드: {campaign.keyword} | 상품 ID: {campaign.productId}
            </p>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 작업</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTasks}</div>
                <p className="text-xs text-muted-foreground">
                  완료: {stats.completedTasks} | 대기: {stats.pendingTasks}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 순위</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.averageRank ? `${stats.averageRank}위` : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  최고: {stats.bestRank ? `${stats.bestRank}위` : "N/A"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">성공률</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successRate}%</div>
                <p className="text-xs text-muted-foreground">
                  실패: {stats.failedTasks}개
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">실행 중</CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.runningTasks}</div>
                <p className="text-xs text-muted-foreground">현재 실행 중인 작업</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Tasks Table */}
        <Card>
          <CardHeader>
            <CardTitle>작업 목록 ({tasks?.length || 0})</CardTitle>
            <CardDescription>캠페인의 순위 체크 작업들</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>순위</TableHead>
                  <TableHead>변수</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      등록된 작업이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks?.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-sm">#{task.id}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {task.rank ? (
                          <span className="font-semibold text-green-600">{task.rank}위</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        UA:{task.uaChange} | SH:{task.shopHome} | NID:{task.useNid}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(task.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExecuteTask(task.id)}
                              disabled={executeMutation.isPending}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              실행
                            </Button>
                          )}
                          {task.status === "failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(task.id)}
                              disabled={retryMutation.isPending}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              재시도
                            </Button>
                          )}
                          {task.errorMessage && (
                            <span className="text-xs text-red-600" title={task.errorMessage}>
                              에러: {task.errorMessage.substring(0, 30)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
