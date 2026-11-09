const fs = require('fs');

// We will construct the complete XML document for draw.io
// Styles matching the user's diagram:

const STYLE_SWIMLANE = 'swimlane;horizontal=0;whiteSpace=wrap;html=1;startSize=40;';

const STYLE_START_EVENT = 'points=[[0.145,0.145,0],[0.5,0,0],[0.855,0.145,0],[1,0.5,0],[0.855,0.855,0],[0.5,1,0],[0.145,0.855,0],[0,0.5,0]];shape=mxgraph.bpmn.event;html=1;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;align=center;perimeter=ellipsePerimeter;outlineConnect=0;aspect=fixed;outline=standard;symbol=general;labelPerimeter=1;';

const STYLE_END_EVENT = 'points=[[0.145,0.145,0],[0.5,0,0],[0.855,0.145,0],[1,0.5,0],[0.855,0.855,0],[0.5,1,0],[0.145,0.855,0],[0,0.5,0]];shape=mxgraph.bpmn.event;html=1;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;align=center;perimeter=ellipsePerimeter;outlineConnect=0;aspect=fixed;outline=end;symbol=general;labelPerimeter=1;';

const getTaskStyle = (marker) => {
  return `points=[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];shape=mxgraph.bpmn.task2;whiteSpace=wrap;rectStyle=rounded;size=10;html=1;container=1;expand=0;collapsible=0;taskMarker=${marker};`;
};

const STYLE_GATEWAY = 'points=[[0.25,0.25,0],[0.5,0,0],[0.75,0.25,0],[1,0.5,0],[0.75,0.75,0],[0.5,1,0],[0.25,0.75,0],[0,0.5,0]];shape=mxgraph.bpmn.gateway2;html=1;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;align=center;perimeter=rhombusPerimeter;outlineConnect=0;outline=none;symbol=none;gwType=exclusive;labelPerimeter=1;';

const STYLE_SEQUENCE_FLOW = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;defaultLabelBackgroundColor=page;';

const STYLE_MESSAGE_FLOW = 'dashed=1;dashPattern=8 4;endArrow=blockThin;endFill=1;startArrow=oval;startFill=0;endSize=6;startSize=4;html=1;rounded=0;defaultLabelBackgroundColor=page;edgeStyle=orthogonalEdgeStyle;';

const STYLE_EDGE_LABEL = 'edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];inheritText=1;defaultLabelBackgroundColor=page;';

// Data model
const pools = [
  { id: 'pool_khach_hang', name: 'Khách hàng', x: 40, y: 80, width: 5900, height: 320 },
  { id: 'pool_he_thong', name: 'Hệ thống Evergreen Mart', x: 40, y: 430, width: 5900, height: 310 },
  { id: 'pool_ngan_hang', name: 'Ngân hàng', x: 40, y: 770, width: 5900, height: 250 },
  { id: 'pool_van_hanh_kho', name: 'Bộ phận Vận hành &amp; Kho', x: 40, y: 1050, width: 5900, height: 270 },
  { id: 'pool_cskh', name: 'Bộ phận Chăm sóc khách hàng (CSKH)', x: 40, y: 1350, width: 5900, height: 280 }
];

const nodes = [];
const edges = [];

function addNode({ id, parent, type, marker, value, x, y, width, height }) {
  nodes.push({ id, parent, type, marker, value, x, y, width: width || 120, height: height || 80 });
}

function addSequenceFlow({ id, parent, source, target, value, exitX, exitY, entryX, entryY, points }) {
  edges.push({ id, parent, source, target, value, isMessage: false, exitX, exitY, entryX, entryY, points });
}

function addMessageFlow({ id, source, target, value, exitX, exitY, entryX, entryY, points }) {
  edges.push({ id, parent: '1', source, target, value, isMessage: true, exitX, exitY, entryX, entryY, points });
}

// ==========================================
// 1. POOL KHÁCH HÀNG
// ==========================================
// Start event
addNode({ id: 'evt_start', parent: 'pool_khach_hang', type: 'start', value: '', x: 70, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c1', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Truy cập website Evergreen Mart', x: 170, y: 80 });
addNode({ id: 'task_c2', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Khám phá sản phẩm', x: 350, y: 80 });
addNode({ id: 'gw_c1', parent: 'pool_khach_hang', type: 'gateway', value: 'Thêm vào giỏ hàng?', x: 530, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c3', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Thêm sản phẩm vào giỏ hàng', x: 650, y: 80 });
addNode({ id: 'task_c4', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Đăng nhập', x: 950, y: 80 });
addNode({ id: 'task_c5', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Xem giỏ hàng', x: 1150, y: 80 });
addNode({ id: 'task_c6', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Chọn sản phẩm cần mua và xác nhận đặt', x: 1340, y: 80 });
addNode({ id: 'task_c7', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Nhập thông tin giao hàng &amp; chọn phương thức nhận', x: 1530, y: 80 });
addNode({ id: 'task_c8', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Chọn phương thức thanh toán', x: 1720, y: 80 });
addNode({ id: 'gw_c2', parent: 'pool_khach_hang', type: 'gateway', value: 'Phương thức thanh toán?', x: 1910, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c9', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Quét mã VietQR và thanh toán', x: 2240, y: 80 });
addNode({ id: 'task_c10', parent: 'pool_khach_hang', type: 'task', marker: 'receive', value: 'Nhận thông báo xác nhận đơn hàng', x: 2980, y: 80 });
addNode({ id: 'task_c11', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Theo dõi trạng thái đơn hàng', x: 3160, y: 80 });
addNode({ id: 'task_c12', parent: 'pool_khach_hang', type: 'task', marker: 'manual', value: 'Khách hàng nhận hàng', x: 3740, y: 80 });
addNode({ id: 'gw_c3', parent: 'pool_khach_hang', type: 'gateway', value: 'Đơn hàng COD?', x: 3920, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c13', parent: 'pool_khach_hang', type: 'task', marker: 'manual', value: 'Thanh toán tiền mặt cho nhân viên giao hàng', x: 4040, y: 190 });
addNode({ id: 'task_c14', parent: 'pool_khach_hang', type: 'task', marker: 'manual', value: 'Kiểm tra hàng (chất lượng tươi ngon, đúng số lượng)', x: 4230, y: 80 });
addNode({ id: 'gw_c4', parent: 'pool_khach_hang', type: 'gateway', value: 'Hài lòng &amp; đạt chuẩn?', x: 4420, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c15', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Xác nhận nhận hàng thành công', x: 4550, y: 80 });
addNode({ id: 'evt_end1', parent: 'pool_khach_hang', type: 'end', value: 'Hoàn tất đơn hàng', x: 4740, y: 95, width: 50, height: 50 });
addNode({ id: 'task_c16', parent: 'pool_khach_hang', type: 'task', marker: 'user', value: 'Gửi yêu cầu đổi/trả kèm ảnh chụp (trong 24h)', x: 4550, y: 200 });
addNode({ id: 'task_c17', parent: 'pool_khach_hang', type: 'task', marker: 'receive', value: 'Nhận thông báo từ chối &amp; đóng khiếu nại', x: 5300, y: 200 });
addNode({ id: 'evt_end2', parent: 'pool_khach_hang', type: 'end', value: 'Đóng khiếu nại', x: 5480, y: 215, width: 50, height: 50 });
addNode({ id: 'task_c18', parent: 'pool_khach_hang', type: 'task', marker: 'manual', value: 'Nhận sản phẩm đổi mới tươi sống', x: 5560, y: 40 });
addNode({ id: 'evt_end3', parent: 'pool_khach_hang', type: 'end', value: 'Đổi hàng thành công', x: 5740, y: 55, width: 50, height: 50 });
addNode({ id: 'task_c19', parent: 'pool_khach_hang', type: 'task', marker: 'receive', value: 'Nhận tiền hoàn qua tài khoản ngân hàng', x: 5560, y: 140 });
addNode({ id: 'evt_end4', parent: 'pool_khach_hang', type: 'end', value: 'Hoàn tiền thành công', x: 5740, y: 155, width: 50, height: 50 });

// Sequence flows in Khách hàng
addSequenceFlow({ id: 'flow_c_1', parent: 'pool_khach_hang', source: 'evt_start', target: 'task_c1' });
addSequenceFlow({ id: 'flow_c_2', parent: 'pool_khach_hang', source: 'task_c1', target: 'task_c2' });
addSequenceFlow({ id: 'flow_c_3', parent: 'pool_khach_hang', source: 'task_c2', target: 'gw_c1' });
addSequenceFlow({ id: 'flow_c_4', parent: 'pool_khach_hang', source: 'gw_c1', target: 'task_c3', value: 'Có' });
addSequenceFlow({ id: 'flow_c_5', parent: 'pool_khach_hang', source: 'gw_c1', target: 'task_c2', value: 'Không', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 0, points: [{ x: 555, y: 50 }, { x: 410, y: 50 }] });
addSequenceFlow({ id: 'flow_c_6', parent: 'pool_khach_hang', source: 'task_c4', target: 'task_c3', points: [{ x: 1010, y: 50 }, { x: 710, y: 50 }] });
addSequenceFlow({ id: 'flow_c_7', parent: 'pool_khach_hang', source: 'task_c5', target: 'task_c6' });
addSequenceFlow({ id: 'flow_c_8', parent: 'pool_khach_hang', source: 'task_c6', target: 'task_c7' });
addSequenceFlow({ id: 'flow_c_9', parent: 'pool_khach_hang', source: 'task_c7', target: 'task_c8' });
addSequenceFlow({ id: 'flow_c_10', parent: 'pool_khach_hang', source: 'task_c8', target: 'gw_c2' });
addSequenceFlow({ id: 'flow_c_11', parent: 'pool_khach_hang', source: 'gw_c2', target: 'task_c9', value: 'VietQR', exitX: 0.5, exitY: 0, entryX: 0, entryY: 0.5, points: [{ x: 1935, y: 50 }, { x: 2200, y: 50 }, { x: 2200, y: 120 }] });
addSequenceFlow({ id: 'flow_c_12', parent: 'pool_khach_hang', source: 'task_c10', target: 'task_c11' });
addSequenceFlow({ id: 'flow_c_13', parent: 'pool_khach_hang', source: 'task_c11', target: 'task_c12' });
addSequenceFlow({ id: 'flow_c_14', parent: 'pool_khach_hang', source: 'task_c12', target: 'gw_c3' });
addSequenceFlow({ id: 'flow_c_15', parent: 'pool_khach_hang', source: 'gw_c3', target: 'task_c13', value: 'Có (COD)', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_c_16', parent: 'pool_khach_hang', source: 'gw_c3', target: 'task_c14', value: 'Không (Đã CK)', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_c_17', parent: 'pool_khach_hang', source: 'task_c13', target: 'task_c14', exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 1 });
addSequenceFlow({ id: 'flow_c_18', parent: 'pool_khach_hang', source: 'task_c14', target: 'gw_c4' });
addSequenceFlow({ id: 'flow_c_19', parent: 'pool_khach_hang', source: 'gw_c4', target: 'task_c15', value: 'Có (Hài lòng)' });
addSequenceFlow({ id: 'flow_c_20', parent: 'pool_khach_hang', source: 'task_c15', target: 'evt_end1' });
addSequenceFlow({ id: 'flow_c_21', parent: 'pool_khach_hang', source: 'gw_c4', target: 'task_c16', value: 'Không (Khiếu nại/Đổi/Trả)', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_c_22', parent: 'pool_khach_hang', source: 'task_c17', target: 'evt_end2' });
addSequenceFlow({ id: 'flow_c_23', parent: 'pool_khach_hang', source: 'task_c18', target: 'evt_end3' });
addSequenceFlow({ id: 'flow_c_24', parent: 'pool_khach_hang', source: 'task_c19', target: 'evt_end4' });

// ==========================================
// 2. POOL HỆ THỐNG EVERGREEN MART
// ==========================================
addNode({ id: 'task_s1', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Kiểm tra phiên đăng nhập', x: 650, y: 70 });
addNode({ id: 'gw_s1', parent: 'pool_he_thong', type: 'gateway', value: 'Đã đăng nhập?', x: 820, y: 85, width: 50, height: 50 });
addNode({ id: 'task_s2', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Yêu cầu đăng nhập', x: 950, y: 70 });
addNode({ id: 'task_s3', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Cho phép thêm sản phẩm vào giỏ hàng', x: 950, y: 190 });
addNode({ id: 'task_s4', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Tính phí ship OSRM &amp; kiểm tra bán kính 10km', x: 1530, y: 70 });
addNode({ id: 'task_s5', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Tạo đơn hàng COD (chờ xử lý)', x: 2020, y: 70 });
addNode({ id: 'task_s6', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Tạo yêu cầu thanh toán &amp; sinh mã VietQR', x: 2020, y: 190 });
addNode({ id: 'task_s7', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Nhận Webhook &amp; xác nhận thanh toán', x: 2620, y: 190 });
addNode({ id: 'task_s8', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Tạo đơn hàng &amp; trừ tồn kho tạm giữ', x: 2800, y: 70 });
addNode({ id: 'task_s9', parent: 'pool_he_thong', type: 'task', marker: 'send', value: 'Gửi thông báo xác nhận đơn hàng', x: 2980, y: 70 });
addNode({ id: 'task_s10', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Cập nhật trạng thái hoàn tất &amp; tích điểm Loyalty', x: 4550, y: 70 });
addNode({ id: 'task_s11', parent: 'pool_he_thong', type: 'task', marker: 'service', value: 'Tiếp nhận khiếu nại đổi/trả &amp; lưu ảnh minh chứng', x: 4550, y: 190 });

// Sequence flows in Hệ thống
addSequenceFlow({ id: 'flow_s_1', parent: 'pool_he_thong', source: 'task_s1', target: 'gw_s1' });
addSequenceFlow({ id: 'flow_s_2', parent: 'pool_he_thong', source: 'gw_s1', target: 'task_s2', value: 'Chưa' });
addSequenceFlow({ id: 'flow_s_3', parent: 'pool_he_thong', source: 'gw_s1', target: 'task_s3', value: 'Rồi', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_s_4', parent: 'pool_he_thong', source: 'task_s5', target: 'task_s8' });
addSequenceFlow({ id: 'flow_s_5', parent: 'pool_he_thong', source: 'task_s7', target: 'task_s8', exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 1 });
addSequenceFlow({ id: 'flow_s_6', parent: 'pool_he_thong', source: 'task_s8', target: 'task_s9' });

// ==========================================
// 3. POOL NGÂN HÀNG
// ==========================================
addNode({ id: 'task_b1', parent: 'pool_ngan_hang', type: 'task', marker: 'service', value: 'Tiếp nhận giao dịch chuyển khoản VietQR', x: 2240, y: 80 });
addNode({ id: 'task_b2', parent: 'pool_ngan_hang', type: 'task', marker: 'service', value: 'Xử lý giao dịch &amp; gửi Webhook xác nhận', x: 2440, y: 80 });
addNode({ id: 'task_b3', parent: 'pool_ngan_hang', type: 'task', marker: 'service', value: 'Xử lý lệnh hoàn tiền vào tài khoản khách', x: 5360, y: 80 });

// Sequence flows in Ngân hàng
addSequenceFlow({ id: 'flow_b_1', parent: 'pool_ngan_hang', source: 'task_b1', target: 'task_b2' });

// ==========================================
// 4. POOL BỘ PHẬN VẬN HÀNH & KHO
// ==========================================
addNode({ id: 'task_w1', parent: 'pool_van_hanh_kho', type: 'task', marker: 'receive', value: 'Tiếp nhận thông tin đơn hàng mới', x: 3160, y: 70 });
addNode({ id: 'task_w2', parent: 'pool_van_hanh_kho', type: 'task', marker: 'manual', value: 'Kiểm tra tồn kho &amp; soạn hàng tươi sống theo đơn', x: 3340, y: 70 });
addNode({ id: 'task_w3', parent: 'pool_van_hanh_kho', type: 'task', marker: 'manual', value: 'Đóng gói &amp; bảo quản lạnh (thịt, cá, rau, củ, quả)', x: 3520, y: 70 });
addNode({ id: 'task_w4', parent: 'pool_van_hanh_kho', type: 'task', marker: 'manual', value: 'Xuất kho &amp; vận chuyển bằng xe lạnh (bán kính 10km)', x: 3700, y: 70 });
addNode({ id: 'task_w5', parent: 'pool_van_hanh_kho', type: 'task', marker: 'manual', value: 'Thu tiền COD &amp; cập nhật trạng thái đã giao hàng', x: 4040, y: 70 });
addNode({ id: 'task_w6', parent: 'pool_van_hanh_kho', type: 'task', marker: 'manual', value: 'Xuất kho sản phẩm mới &amp; giao bù đổi hàng cho khách', x: 5360, y: 70 });

// Sequence flows in Kho
addSequenceFlow({ id: 'flow_w_1', parent: 'pool_van_hanh_kho', source: 'task_w1', target: 'task_w2' });
addSequenceFlow({ id: 'flow_w_2', parent: 'pool_van_hanh_kho', source: 'task_w2', target: 'task_w3' });
addSequenceFlow({ id: 'flow_w_3', parent: 'pool_van_hanh_kho', source: 'task_w3', target: 'task_w4' });

// ==========================================
// 5. POOL BỘ PHẬN CHĂM SÓC KHÁCH HÀNG (CSKH)
// ==========================================
addNode({ id: 'task_cs1', parent: 'pool_cskh', type: 'task', marker: 'service', value: 'Tiếp nhận yêu cầu khiếu nại &amp; kiểm tra thông tin', x: 4740, y: 70 });
addNode({ id: 'gw_cs1', parent: 'pool_cskh', type: 'gateway', value: 'Thuộc 4 nhóm tươi sống &amp; có ảnh trong 24h?', x: 4930, y: 85, width: 50, height: 50 });
addNode({ id: 'task_cs2', parent: 'pool_cskh', type: 'task', marker: 'service', value: 'Thông báo từ chối đổi/trả &amp; giải thích chính sách', x: 5100, y: 170 });
addNode({ id: 'gw_cs2', parent: 'pool_cskh', type: 'gateway', value: 'Phương thức xử lý?', x: 5100, y: 85, width: 50, height: 50 });
addNode({ id: 'task_cs3', parent: 'pool_cskh', type: 'task', marker: 'service', value: 'Phê duyệt đổi hàng 1-1 &amp; gửi lệnh xuất kho bù', x: 5230, y: 40 });
addNode({ id: 'task_cs4', parent: 'pool_cskh', type: 'task', marker: 'service', value: 'Phê duyệt trả hàng &amp; lập lệnh hoàn tiền', x: 5230, y: 120 });

// Sequence flows in CSKH
addSequenceFlow({ id: 'flow_cs_1', parent: 'pool_cskh', source: 'task_cs1', target: 'gw_cs1' });
addSequenceFlow({ id: 'flow_cs_2', parent: 'pool_cskh', source: 'gw_cs1', target: 'task_cs2', value: 'Không đạt', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_cs_3', parent: 'pool_cskh', source: 'gw_cs1', target: 'gw_cs2', value: 'Hợp lệ' });
addSequenceFlow({ id: 'flow_cs_4', parent: 'pool_cskh', source: 'gw_cs2', target: 'task_cs3', value: 'Đổi hàng (1-1)', exitX: 0.5, exitY: 0, entryX: 0, entryY: 0.5 });
addSequenceFlow({ id: 'flow_cs_5', parent: 'pool_cskh', source: 'gw_cs2', target: 'task_cs4', value: 'Trả hàng / Hoàn tiền', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });

// ==========================================
// 6. MESSAGE FLOWS (INTER-POOL INTERACTIONS)
// ==========================================
// Khách thêm giỏ -> Hệ thống kiểm tra đăng nhập
addMessageFlow({ id: 'msg_1', source: 'task_c3', target: 'task_s1' });
// Hệ thống yêu cầu đăng nhập -> Khách thực hiện đăng nhập
addMessageFlow({ id: 'msg_2', source: 'task_s2', target: 'task_c4' });
// Hệ thống cho phép thêm giỏ -> Khách mở Xem giỏ hàng
addMessageFlow({ id: 'msg_3', source: 'task_s3', target: 'task_c5' });
// Khách nhập địa chỉ giao hàng -> Hệ thống tính phí OSRM
addMessageFlow({ id: 'msg_4', source: 'task_c7', target: 'task_s4' });
// Khách chọn COD -> Hệ thống tạo đơn hàng COD
addMessageFlow({ id: 'msg_5', source: 'gw_c2', target: 'task_s5', value: 'COD', exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 });
// Khách chọn VietQR -> Hệ thống tạo yêu cầu thanh toán & mã VietQR
addMessageFlow({ id: 'msg_6', source: 'gw_c2', target: 'task_s6', value: 'VietQR', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 });
// Hệ thống hiển thị QR -> Khách quét mã
addMessageFlow({ id: 'msg_7', source: 'task_s6', target: 'task_c9', exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 1 });
// Khách quét mã VietQR -> Ngân hàng tiếp nhận giao dịch
addMessageFlow({ id: 'msg_8', source: 'task_c9', target: 'task_b1', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// Ngân hàng gửi webhook -> Hệ thống nhận webhook
addMessageFlow({ id: 'msg_9', source: 'task_b2', target: 'task_s7', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 });
// Hệ thống gửi thông báo xác nhận -> Khách nhận thông báo
addMessageFlow({ id: 'msg_10', source: 'task_s9', target: 'task_c10', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// Hệ thống gửi thông tin đơn hàng -> Bộ phận Vận hành & Kho tiếp nhận
addMessageFlow({ id: 'msg_11', source: 'task_s9', target: 'task_w1', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// Kho giao hàng -> Khách hàng nhận hàng
addMessageFlow({ id: 'msg_12', source: 'task_w4', target: 'task_c12', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// Khách trả tiền COD -> Nhân viên giao hàng thu tiền
addMessageFlow({ id: 'msg_13', source: 'task_c13', target: 'task_w5', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// Khách xác nhận thành công -> Hệ thống tích điểm Loyalty
addMessageFlow({ id: 'msg_14', source: 'task_c15', target: 'task_s10', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// Khách gửi khiếu nại đổi/trả -> Hệ thống lưu hồ sơ
addMessageFlow({ id: 'msg_15', source: 'task_c16', target: 'task_s11', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// Hệ thống chuyển hồ sơ khiếu nại -> CSKH tiếp nhận
addMessageFlow({ id: 'msg_16', source: 'task_s11', target: 'task_cs1', exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
// CSKH từ chối khiếu nại -> Khách nhận thông báo giải thích chính sách
addMessageFlow({ id: 'msg_17', source: 'task_cs2', target: 'task_c17', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// CSKH duyệt đổi hàng -> Kho xuất sản phẩm mới bù
addMessageFlow({ id: 'msg_18', source: 'task_cs3', target: 'task_w6', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// Kho giao hàng đổi -> Khách nhận sản phẩm đổi
addMessageFlow({ id: 'msg_19', source: 'task_w6', target: 'task_c18', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// CSKH duyệt hoàn tiền -> Ngân hàng thực hiện hoàn tiền
addMessageFlow({ id: 'msg_20', source: 'task_cs4', target: 'task_b3', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });
// Ngân hàng hoàn tiền -> Khách nhận tiền vào tài khoản
addMessageFlow({ id: 'msg_21', source: 'task_b3', target: 'task_c19', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 });

console.log('Total Pools:', pools.length);
console.log('Total Nodes:', nodes.length);
console.log('Total Sequence Flows:', edges.filter(e => !e.isMessage).length);
console.log('Total Message Flows:', edges.filter(e => e.isMessage).length);
console.log('Grand Total Edges:', edges.length);
