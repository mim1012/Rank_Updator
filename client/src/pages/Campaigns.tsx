import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Play, Pause, Trash2, Edit2, Loader2, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    platform: "naver" as "naver" | "coupang",
    keyword: "",
    productId: "",
  });

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery();
  const createMutation = trpc.campaigns.create.useMutation();
  const updateMutation = trpc.campaigns.update.useMutation();
  const startMutation = trpc.campaigns.start.useMutation();
  const stopMutation = trpc.campaigns.stop.useMutation();
  const deleteMutation = trpc.campaigns.delete.useMutation();

  const resetForm = () => {
    setFormData({
      name: "",
      platform: "naver",
      keyword: "",
      productId: "",
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(formData);
      toast.success("캠페인이 생성되었습니다.");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || "캠페인 생성 실패");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await updateMutation.mutateAsync({
        id: editingCampaign.id,
        ...formData,
      });
      toast.success("캠페인이 수정되었습니다.");
      setIsEditDialogOpen(false);
      setEditingCampaign(null);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || "캠페인 수정 실패");
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startMutation.mutateAsync({ id });
      toast.success("캠페인이 시작되었습니다.");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "캠페인 시작 실패");
    }
  };

  const handleStop = async (id: number) => {
    try {
      await stopMutation.mutateAsync({ id });
      toast.success("캠페인이 중지되었습니다.");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "캠페인 중지 실패");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 캠페인을 삭제하시겠습니까?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("캠페인이 삭제되었습니다.");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "캠페인 삭제 실패");
    }
  };

  const openEditDialog = (campaign: any) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      platform: campaign.platform,
      keyword: campaign.keyword,
      productId: campaign.productId,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      paused: "bg-gray-100 text-gray-800",
      completed: "bg-blue-100 text-blue-800",
    };
    const labels = {
      active: "활성",
      paused: "일시정지",
      completed: "완료",
    };
    return (
      <Badge className={variants[status as keyof typeof variants] || ""}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getPlatformBadge = (platform: string) => {
    return platform === "naver" ? (
      <Badge className="bg-green-500 text-white">네이버</Badge>
    ) : (
      <Badge className="bg-orange-500 text-white">쿠팡</Badge>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">캠페인 관리</h1>
            <p className="text-gray-500 mt-1">검색 순위 캠페인을 관리하세요</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                새 캠페인
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>새 캠페인 만들기</DialogTitle>
                  <DialogDescription>
                    새로운 검색 순위 캠페인을 생성하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">캠페인 이름</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="예: 갤럭시 S24 검색"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="platform">플랫폼</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value: "naver" | "coupang") =>
                        setFormData({ ...formData, platform: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="naver">네이버 쇼핑</SelectItem>
                        <SelectItem value="coupang">쿠팡</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="keyword">키워드</Label>
                    <Input
                      id="keyword"
                      value={formData.keyword}
                      onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                      placeholder="예: 갤럭시 S24"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="productId">상품 ID</Label>
                    <Input
                      id="productId"
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      placeholder="예: 12345678"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "생성 중..." : "생성"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>전체 캠페인 ({campaigns?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>플랫폼</TableHead>
                  <TableHead>키워드</TableHead>
                  <TableHead>상품 ID</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      등록된 캠페인이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns?.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{getPlatformBadge(campaign.platform)}</TableCell>
                      <TableCell>{campaign.keyword}</TableCell>
                      <TableCell className="font-mono text-sm">{campaign.productId}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/campaigns/${campaign.id}`)}
                            title="상세보기"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(campaign)}
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {campaign.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStop(campaign.id)}
                              disabled={stopMutation.isPending}
                              title="일시정지"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStart(campaign.id)}
                              disabled={startMutation.isPending}
                              title="시작"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(campaign.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>캠페인 수정</DialogTitle>
                <DialogDescription>캠페인 정보를 수정하세요.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">캠페인 이름</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-platform">플랫폼</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value: "naver" | "coupang") =>
                      setFormData({ ...formData, platform: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="naver">네이버 쇼핑</SelectItem>
                      <SelectItem value="coupang">쿠팡</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-keyword">키워드</Label>
                  <Input
                    id="edit-keyword"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-productId">상품 ID</Label>
                  <Input
                    id="edit-productId"
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingCampaign(null);
                    resetForm();
                  }}
                >
                  취소
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
