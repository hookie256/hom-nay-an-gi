import type { Ingredient } from '@/types/models';

type Row = [slug: string, name: string, group: string, aliases?: string[], avoidTags?: string[]];

const rows: Row[] = [
  // rau củ
  ['ca-chua', 'Cà chua', 'rau-cu'],
  ['hanh-la', 'Hành lá', 'rau-cu', ['hành hoa', 'hành xanh']],
  ['hanh-tim', 'Hành tím', 'rau-cu', ['hành khô', 'hành củ']],
  ['hanh-tay', 'Hành tây', 'rau-cu'],
  ['toi', 'Tỏi', 'rau-cu'],
  ['gung', 'Gừng', 'rau-cu'],
  ['ot', 'Ớt', 'rau-cu', ['ớt tươi']],
  ['sa', 'Sả', 'rau-cu', ['cây sả']],
  ['chanh', 'Chanh', 'rau-cu'],
  ['rau-mui', 'Rau mùi', 'rau-cu', ['ngò', 'ngò rí']],
  ['rau-thom', 'Rau thơm', 'rau-cu', ['rau húng', 'húng quế']],
  ['xa-lach', 'Xà lách', 'rau-cu', ['rau diếp']],
  ['dua-chuot', 'Dưa chuột', 'rau-cu', ['dưa leo']],
  ['ca-rot', 'Cà rốt', 'rau-cu'],
  ['khoai-tay', 'Khoai tây', 'rau-cu'],
  ['bi-do', 'Bí đỏ', 'rau-cu', ['bí ngô']],
  ['rau-muong', 'Rau muống', 'rau-cu'],
  ['cai-ngot', 'Cải ngọt', 'rau-cu'],
  ['gia-do', 'Giá đỗ', 'rau-cu', ['giá', 'đậu mầm']],
  ['nam-huong', 'Nấm hương', 'rau-cu', ['nấm đông cô']],
  ['dua', 'Dứa', 'rau-cu', ['thơm', 'khóm']],
  ['me', 'Me chua', 'rau-cu', ['me']],
  ['ot-chuong', 'Ớt chuông', 'rau-cu'],
  ['dau-que', 'Đậu que', 'rau-cu', ['đậu cô ve']],
  // thịt
  ['thit-ba-chi', 'Thịt ba chỉ', 'thit', ['ba rọi']],
  ['thit-lon-nac', 'Thịt lợn nạc', 'thit', ['thịt heo nạc', 'thịt nạc']],
  ['thit-lon-xay', 'Thịt lợn xay', 'thit', ['thịt băm', 'thịt heo xay']],
  ['suon-lon', 'Sườn lợn', 'thit', ['sườn heo', 'sườn non']],
  ['thit-bo', 'Thịt bò', 'thit'],
  ['xuong-bo', 'Xương bò', 'thit', ['xương ống bò']],
  ['thit-ga', 'Thịt gà', 'thit', ['ức gà', 'đùi gà']],
  // hải sản
  ['tom', 'Tôm', 'hai-san', ['tôm tươi'], ['hai-san', 'giap-xac']],
  ['muc', 'Mực', 'hai-san', ['mực ống'], ['hai-san']],
  ['ngao', 'Ngao', 'hai-san', ['nghêu'], ['hai-san']],
  ['ca-hoi', 'Cá hồi', 'hai-san', [], ['hai-san', 'ca']],
  ['ca-loc', 'Cá lóc', 'hai-san', ['cá quả'], ['ca']],
  // trứng sữa
  ['trung-ga', 'Trứng gà', 'trung-sua', ['trứng'], ['trung']],
  ['trung-vit', 'Trứng vịt', 'trung-sua', [], ['trung']],
  ['sua-tuoi', 'Sữa tươi', 'trung-sua', ['sữa'], ['sua']],
  ['bo-lat', 'Bơ lạt', 'trung-sua', ['bơ động vật'], ['sua']],
  ['pho-mai', 'Phô mai', 'trung-sua', ['phô-mát'], ['sua']],
  // ngũ cốc
  ['gao-te', 'Gạo tẻ', 'ngu-coc', ['gạo']],
  ['com-nguoi', 'Cơm nguội', 'ngu-coc', ['cơm trắng']],
  ['banh-pho', 'Bánh phở', 'ngu-coc', ['phở tươi']],
  ['bun-tuoi', 'Bún tươi', 'ngu-coc', ['bún']],
  ['mi-trung', 'Mì trứng', 'ngu-coc', ['mì vàng'], ['gluten', 'trung']],
  ['mien', 'Miến dong', 'ngu-coc', ['miến']],
  ['banh-mi', 'Bánh mì', 'ngu-coc', ['bánh mì que', 'bánh mì Việt Nam'], ['gluten']],
  ['banh-trang', 'Bánh tráng', 'ngu-coc', ['bánh đa nem', 'bánh tráng cuốn']],
  ['bot-gao', 'Bột gạo', 'ngu-coc'],
  ['yen-mach', 'Yến mạch', 'ngu-coc', ['oats'], ['gluten']],
  // gia vị
  ['nuoc-mam', 'Nước mắm', 'gia-vi', [], ['ca']],
  ['muoi', 'Muối', 'gia-vi'],
  ['duong', 'Đường', 'gia-vi', ['đường trắng', 'đường cát']],
  ['hat-tieu', 'Hạt tiêu', 'gia-vi', ['tiêu', 'tiêu xay']],
  ['dau-an', 'Dầu ăn', 'gia-vi', ['dầu thực vật']],
  ['dau-hao', 'Dầu hào', 'gia-vi', ['dầu hàu'], ['hai-san']],
  ['xi-dau', 'Xì dầu', 'gia-vi', ['nước tương'], ['dau-nanh']],
  ['hat-nem', 'Hạt nêm', 'gia-vi'],
  ['mat-ong', 'Mật ong', 'gia-vi'],
  ['que-hoi', 'Quế, hồi', 'gia-vi', ['hoa hồi', 'thảo quả']],
  ['nghe', 'Bột nghệ', 'gia-vi', ['nghệ']],
  ['tuong-ca', 'Tương cà', 'gia-vi', ['sốt cà chua']],
  ['giam', 'Giấm', 'gia-vi', ['giấm gạo']],
  // khác
  ['dau-phu', 'Đậu phụ', 'khac', ['đậu hũ', 'tàu hũ'], ['dau-nanh']],
  ['lac', 'Lạc rang', 'khac', ['đậu phộng'], ['dau-phong']],
  ['vung', 'Vừng', 'khac', ['mè']],
  ['nuoc-dua', 'Nước dừa', 'khac', ['nước dừa tươi']],
  ['nuoc-cot-dua', 'Nước cốt dừa', 'khac', ['cốt dừa']],
  ['bot-mi', 'Bột mì', 'khac', ['bột mỳ'], ['gluten']],
];

const subs: Record<string, [string, string][]> = {
  'hanh-tim': [['hanh-tay', 'Vị ngọt hơn, ít thơm hơn khi phi.']],
  'hanh-tay': [['hanh-tim', 'Thơm hơn nhưng hăng hơn; dùng lượng ít hơn.']],
  'trung-ga': [['trung-vit', 'Trứng vịt to và béo hơn, có thể giảm số lượng.']],
  'trung-vit': [['trung-ga', 'Trứng gà nhỏ hơn, có thể tăng số lượng.']],
  'duong': [['mat-ong', 'Mật ong ngọt hơn và có mùi riêng; dùng khoảng ⅔ lượng đường.']],
  'nuoc-mam': [['xi-dau', 'Phù hợp khi nấu chay; vị nhạt hơn nên nêm thêm muối.']],
  'bun-tuoi': [['banh-pho', 'Sợi to và mềm hơn.']],
  'banh-pho': [['bun-tuoi', 'Sợi nhỏ, dai hơn.']],
  'rau-mui': [['rau-thom', 'Mùi vị khác, chỉ dùng để trang trí.']],
  'thit-lon-nac': [['thit-ga', 'Thịt gà chín nhanh hơn, giảm thời gian nấu.']],
  'nuoc-dua': [['nuoc-cot-dua', 'Béo hơn nhiều, pha loãng với nước trước khi dùng.']],
  'chanh': [['giam', 'Chua gắt hơn, không có mùi thơm của vỏ chanh.']],
};

export const seedIngredients: Ingredient[] = rows.map(([slug, name, group, aliases = [], avoidTags = []]) => {
  const s = subs[slug] ?? [];
  return {
    _id: `ing-${slug}`,
    canonicalName: name,
    aliases,
    groupId: group,
    avoidTags,
    substitutionIds: s.map(([id]) => `ing-${id}`),
    substitutionNotes: Object.fromEntries(s.map(([id, note]) => [`ing-${id}`, note])),
    status: 'active',
  };
});
