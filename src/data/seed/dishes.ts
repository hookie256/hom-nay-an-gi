import type { Difficulty, Dish, DishStatus } from '@/types/models';

/**
 * Dữ liệu món ăn mẫu do nhóm biên soạn để chạy thử – CẦN quản trị viên rà soát định lượng và các bước
 * trước khi dùng thật (giả định GD01, rủi ro RR01). Không có dữ liệu dinh dưỡng đã kiểm chứng nên
 * trường nutrition để trống (RR11).
 */

type IngRow = [slug: string, qty: number, unit: string, required?: boolean, note?: string];
type StepRow = [title: string, instruction: string, minutes?: number, note?: string];

interface DishSpec {
  slug: string;
  name: string;
  description: string;
  meals: string[];
  types: string[];
  cuisines: string[];
  tags?: string[];
  tastes?: string[];
  /** undefined = chưa khai báo chế độ ăn */
  diets?: string[];
  servings: number;
  prep: number;
  cook: number;
  difficulty: Difficulty;
  status?: DishStatus;
  publishedAt?: string;
  ingredients: IngRow[];
  steps: StepRow[];
}

const SOURCE = 'Dữ liệu mẫu do nhóm biên soạn – cần rà soát trước khi công bố chính thức.';

function build(spec: DishSpec, index: number): Dish {
  const created = new Date(Date.UTC(2026, 8, 20 + Math.floor(index / 3), 8)).toISOString();
  const status = spec.status ?? 'published';
  return {
    _id: `dish-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    description: spec.description,
    images: [],
    mealSlotIds: spec.meals.map((m) => `cat-bua-${m}`),
    categoryIds: [...spec.types, ...(spec.tags ?? [])].map((t) => `cat-${t}`),
    cuisineIds: spec.cuisines.map((c) => `cat-${c}`),
    tasteTags: spec.tastes ?? [],
    dietCodes: spec.diets,
    baseServings: spec.servings,
    prepMinutes: spec.prep,
    cookMinutes: spec.cook,
    difficulty: spec.difficulty,
    status,
    ingredients: spec.ingredients.map(([slug, quantity, unit, required = true, note]) => ({
      ingredientId: `ing-${slug}`,
      quantity,
      unitId: `unit-${unit}`,
      required,
      ...(note ? { preparationNote: note } : {}),
    })),
    steps: spec.steps.map(([title, instruction, minutes, note], i) => ({
      stepNo: i + 1,
      title,
      instruction,
      ...(minutes !== undefined ? { durationMinutes: minutes } : {}),
      ...(note ? { note } : {}),
    })),
    source: SOURCE,
    publishedAt: status === 'draft' ? undefined : spec.publishedAt ?? created,
    version: 1,
    createdAt: created,
    updatedAt: created,
  };
}

const specs: DishSpec[] = [
  {
    slug: 'trung-sot-ca-chua', name: 'Trứng sốt cà chua',
    description: 'Món cơm nhà quen thuộc: trứng chiên mềm, sốt cà chua chua ngọt, rắc hành lá.',
    meals: ['trua', 'toi'], types: ['mon-kho'], cuisines: ['mien-bac'], tags: ['nhanh-gon', 'cho-tre-em'], tastes: ['chua', 'ngot'], diets: ['it-dau-mo'],
    servings: 2, prep: 5, cook: 12, difficulty: 'easy',
    ingredients: [['trung-ga', 3, 'qua', true, 'đập ra bát, đánh tan'], ['ca-chua', 2, 'qua', true, 'thái múi cau'], ['hanh-la', 2, 'cay', true, 'thái nhỏ'], ['nuoc-mam', 1, 'thia-canh'], ['dau-an', 1, 'thia-canh'], ['duong', 1, 'thia-ca-phe', false], ['hat-tieu', 1, 'g', false]],
    steps: [['Chiên trứng', 'Đun nóng dầu, đổ trứng vào chiên chín vàng hai mặt rồi cắt miếng vừa ăn.', 4], ['Xào cà chua', 'Cho cà chua vào chảo, đảo đến khi mềm và ra nước, nêm nước mắm và đường.', 5], ['Sốt trứng', 'Thả trứng vào sốt, đun nhỏ lửa 2–3 phút cho thấm. Rắc hành lá, tiêu rồi tắt bếp.', 3]],
  },
  {
    slug: 'pho-bo', name: 'Phở bò',
    description: 'Nước dùng ninh xương bò thơm quế hồi, bánh phở mềm và thịt bò tái.',
    meals: ['sang'], types: ['mon-nuoc'], cuisines: ['mien-bac'], tags: ['dai-tiec'], tastes: ['thanh-dam'], diets: [],
    servings: 4, prep: 30, cook: 180, difficulty: 'hard',
    ingredients: [['xuong-bo', 1, 'kg', true, 'chần qua nước sôi'], ['thit-bo', 400, 'g', true, 'thái mỏng'], ['banh-pho', 800, 'g'], ['gung', 1, 'cu', true, 'nướng thơm'], ['hanh-tim', 3, 'cu', true, 'nướng thơm'], ['que-hoi', 10, 'g'], ['nuoc-mam', 3, 'thia-canh'], ['hanh-la', 4, 'cay', false], ['rau-mui', 1, 'nam', false], ['chanh', 1, 'qua', false], ['ot', 1, 'qua', false]],
    steps: [['Sơ chế xương', 'Chần xương bò trong nước sôi 5 phút, rửa sạch để nước dùng trong.', 10], ['Ninh nước dùng', 'Cho xương, gừng, hành nướng và quế hồi vào nồi nước, ninh nhỏ lửa, thường xuyên vớt bọt.', 180, 'Không đậy kín vung để nước trong.'], ['Nêm nếm', 'Nêm nước mắm và muối cho vừa ăn.', 2], ['Hoàn thiện', 'Trụng bánh phở, xếp thịt bò thái mỏng, chan nước dùng thật sôi. Ăn kèm rau thơm, chanh, ớt.', 5]],
  },
  {
    slug: 'banh-mi-op-la', name: 'Bánh mì trứng ốp la',
    description: 'Bữa sáng nhanh gọn với trứng ốp la lòng đào, dưa chuột và xì dầu.',
    meals: ['sang'], types: ['mon-chien'], cuisines: ['mien-nam'], tags: ['nhanh-gon'], tastes: ['beo'], diets: [],
    servings: 1, prep: 3, cook: 5, difficulty: 'easy',
    ingredients: [['banh-mi', 1, 'chiec'], ['trung-ga', 2, 'qua'], ['dau-an', 1, 'thia-canh'], ['dua-chuot', 0.5, 'qua', false, 'thái lát'], ['xi-dau', 1, 'thia-ca-phe', false], ['hat-tieu', 1, 'g', false]],
    steps: [['Ốp trứng', 'Đun nóng dầu, đập trứng vào chảo, chiên đến khi lòng trắng chín, lòng đỏ còn mềm.', 4], ['Làm nóng bánh', 'Nướng hoặc làm nóng bánh mì cho giòn vỏ.', 2], ['Thưởng thức', 'Ăn kèm dưa chuột, rưới xì dầu và rắc tiêu.']],
  },
  {
    slug: 'chao-ga', name: 'Cháo gà',
    description: 'Cháo trắng nấu nước luộc gà, thịt gà xé, gừng và hành lá – nhẹ bụng, dễ ăn.',
    meals: ['sang', 'toi'], types: ['mon-com'], cuisines: ['mien-bac'], tags: ['healthy', 'cho-tre-em'], tastes: ['thanh-dam'], diets: ['it-dau-mo', 'khong-gluten'],
    servings: 3, prep: 10, cook: 45, difficulty: 'medium',
    ingredients: [['thit-ga', 500, 'g'], ['gao-te', 150, 'g', true, 'vo sạch, rang sơ'], ['gung', 1, 'cu', true, 'thái sợi'], ['hanh-la', 3, 'cay'], ['nuoc-mam', 2, 'thia-canh'], ['hat-tieu', 1, 'g', false], ['hanh-tim', 2, 'cu', false, 'phi thơm']],
    steps: [['Luộc gà', 'Luộc gà với vài lát gừng khoảng 20 phút, vớt ra để nguội rồi xé nhỏ.', 20], ['Nấu cháo', 'Cho gạo vào nước luộc gà, nấu nhỏ lửa, khuấy đều để không bị dính đáy.', 25], ['Nêm và trình bày', 'Nêm nước mắm. Múc cháo ra bát, thêm thịt gà, gừng, hành lá, hành phi và tiêu.']],
  },
  {
    slug: 'bun-cha', name: 'Bún chả',
    description: 'Chả thịt nướng thơm khói ăn cùng bún, rau sống và nước chấm chua ngọt.',
    meals: ['trua'], types: ['mon-nuoc'], cuisines: ['mien-bac'], tags: ['dai-tiec'], tastes: ['ngot', 'man'], diets: [],
    servings: 4, prep: 40, cook: 20, difficulty: 'medium',
    ingredients: [['thit-ba-chi', 400, 'g', true, 'thái miếng mỏng'], ['thit-lon-xay', 300, 'g'], ['bun-tuoi', 1, 'kg'], ['hanh-tim', 3, 'cu', true, 'băm nhỏ'], ['toi', 4, 'tep', true, 'băm nhỏ'], ['nuoc-mam', 6, 'thia-canh'], ['duong', 4, 'thia-canh'], ['giam', 2, 'thia-canh'], ['xa-lach', 300, 'g', false], ['rau-thom', 1, 'nam', false], ['ca-rot', 1, 'cu', false, 'thái mỏng làm đồ chua']],
    steps: [['Ướp thịt', 'Ướp thịt ba chỉ và thịt xay với hành, tỏi, nước mắm, đường ít nhất 30 phút. Viên thịt xay thành chả.', 30], ['Nướng chả', 'Nướng thịt và chả trên than hoặc lò đến khi vàng sém.', 15, 'Có thể dùng nồi chiên không dầu 200°C.'], ['Pha nước chấm', 'Hòa nước mắm, đường, giấm với nước ấm theo tỉ lệ 1:1:1:4, thêm tỏi ớt và đồ chua.', 5], ['Thưởng thức', 'Thả chả vào bát nước chấm, ăn kèm bún và rau sống.']],
  },
  {
    slug: 'com-chien-trung', name: 'Cơm chiên trứng',
    description: 'Tận dụng cơm nguội, chiên với trứng và hành lá cho hạt cơm tơi, thơm.',
    meals: ['trua', 'toi'], types: ['mon-com'], cuisines: ['chau-a'], tags: ['nhanh-gon', 'cho-tre-em'], tastes: ['man'], diets: [],
    servings: 2, prep: 5, cook: 10, difficulty: 'easy',
    ingredients: [['com-nguoi', 2, 'chen', true, 'làm tơi'], ['trung-ga', 2, 'qua'], ['hanh-la', 2, 'cay'], ['dau-an', 2, 'thia-canh'], ['xi-dau', 1, 'thia-canh'], ['ca-rot', 0.5, 'cu', false, 'thái hạt lựu'], ['hat-tieu', 1, 'g', false]],
    steps: [['Xào trứng', 'Đánh tan trứng, xào chín tới rồi để riêng.', 2], ['Chiên cơm', 'Phi thơm hành, cho cơm vào đảo lửa lớn đến khi hạt cơm săn lại.', 5], ['Hoàn thiện', 'Cho trứng, cà rốt vào, nêm xì dầu, đảo đều. Rắc hành lá và tiêu.', 3]],
  },
  {
    slug: 'canh-chua-ca-loc', name: 'Canh chua cá lóc',
    description: 'Canh chua miền Nam với cá lóc, dứa, cà chua, giá và me chua.',
    meals: ['trua', 'toi'], types: ['mon-canh'], cuisines: ['mien-nam'], tastes: ['chua', 'ngot'], diets: ['it-dau-mo', 'khong-gluten'],
    servings: 4, prep: 20, cook: 20, difficulty: 'medium',
    ingredients: [['ca-loc', 500, 'g', true, 'cắt khúc, rửa muối'], ['ca-chua', 2, 'qua', true, 'cắt múi cau'], ['dua', 0.25, 'qua', true, 'thái lát'], ['me', 30, 'g', true, 'dầm lấy nước'], ['gia-do', 100, 'g', false], ['nuoc-mam', 3, 'thia-canh'], ['duong', 2, 'thia-canh'], ['rau-thom', 1, 'nam', false], ['ot', 1, 'qua', false]],
    steps: [['Nấu nước dùng', 'Đun sôi 1,5 lít nước với nước me, cho dứa và cà chua vào.', 8], ['Nấu cá', 'Thả cá vào, nấu khoảng 7 phút đến khi cá chín, vớt bọt.', 7], ['Nêm nếm', 'Nêm nước mắm và đường cho vị chua ngọt hài hòa. Cho giá vào rồi tắt bếp.', 3], ['Trình bày', 'Múc ra tô, rắc rau thơm và ớt.']],
  },
  {
    slug: 'thit-kho-trung', name: 'Thịt kho trứng',
    description: 'Thịt ba chỉ kho nước dừa mềm, trứng vịt thấm màu cánh gián.',
    meals: ['trua', 'toi'], types: ['mon-kho'], cuisines: ['mien-nam'], tags: ['dai-tiec'], tastes: ['ngot', 'man'], diets: ['khong-gluten'],
    servings: 4, prep: 15, cook: 90, difficulty: 'medium',
    ingredients: [['thit-ba-chi', 600, 'g', true, 'cắt miếng vuông'], ['trung-vit', 6, 'qua', true, 'luộc chín, bóc vỏ'], ['nuoc-dua', 500, 'ml'], ['nuoc-mam', 4, 'thia-canh'], ['duong', 2, 'thia-canh'], ['hanh-tim', 3, 'cu', true, 'băm nhỏ'], ['toi', 3, 'tep']],
    steps: [['Ướp thịt', 'Ướp thịt với hành tỏi băm, nước mắm, đường khoảng 20 phút.', 20], ['Thắng màu', 'Thắng đường đến khi có màu cánh gián, cho thịt vào đảo săn.', 5], ['Kho', 'Đổ nước dừa ngập thịt, kho nhỏ lửa khoảng 60 phút. Cho trứng vào kho thêm 20 phút.', 80, 'Hớt bọt để nước kho trong.']],
  },
  {
    slug: 'rau-muong-xao-toi', name: 'Rau muống xào tỏi',
    description: 'Rau muống xanh giòn xào lửa lớn với tỏi phi thơm.',
    meals: ['trua', 'toi'], types: ['mon-xao'], cuisines: ['mien-bac'], tags: ['nhanh-gon', 'healthy'], tastes: ['thanh-dam'], diets: ['chay', 'it-duong', 'khong-gluten'],
    servings: 2, prep: 10, cook: 5, difficulty: 'easy',
    ingredients: [['rau-muong', 1, 'bo', true, 'nhặt khúc, rửa sạch'], ['toi', 5, 'tep', true, 'đập dập'], ['dau-an', 1, 'thia-canh'], ['muoi', 0.5, 'thia-ca-phe'], ['hat-nem', 0.5, 'thia-ca-phe', false]],
    steps: [['Chần rau', 'Chần rau muống qua nước sôi có chút muối, vớt ra ngâm nước lạnh.', 2], ['Xào', 'Phi thơm tỏi, cho rau vào đảo nhanh trên lửa lớn, nêm muối và hạt nêm.', 3]],
  },
  {
    slug: 'dau-phu-sot-ca-chua', name: 'Đậu phụ sốt cà chua',
    description: 'Đậu phụ chiên vàng sốt cà chua – món chay dễ làm, đưa cơm.',
    meals: ['trua', 'toi'], types: ['mon-kho'], cuisines: ['mien-bac'], tags: ['nhanh-gon', 'healthy'], tastes: ['chua', 'thanh-dam'], diets: ['chay', 'khong-gluten'],
    servings: 2, prep: 5, cook: 15, difficulty: 'easy',
    ingredients: [['dau-phu', 3, 'mieng', true, 'cắt miếng vừa ăn'], ['ca-chua', 2, 'qua', true, 'thái hạt lựu'], ['hanh-la', 2, 'cay'], ['dau-an', 3, 'thia-canh'], ['xi-dau', 1, 'thia-canh'], ['duong', 1, 'thia-ca-phe', false]],
    steps: [['Chiên đậu', 'Chiên đậu phụ vàng đều các mặt rồi vớt ra.', 8], ['Làm sốt', 'Xào cà chua đến khi nhuyễn, nêm xì dầu và đường, thêm chút nước.', 5], ['Sốt đậu', 'Cho đậu vào đun 2 phút cho thấm, rắc hành lá.', 2]],
  },
  {
    slug: 'ga-xao-sa-ot', name: 'Gà xào sả ớt',
    description: 'Thịt gà săn chắc xào sả ớt thơm cay, đậm đà.',
    meals: ['trua', 'toi'], types: ['mon-xao'], cuisines: ['mien-trung'], tastes: ['cay', 'man'], diets: ['khong-gluten'],
    servings: 3, prep: 15, cook: 15, difficulty: 'medium',
    ingredients: [['thit-ga', 500, 'g', true, 'chặt miếng nhỏ'], ['sa', 3, 'cay', true, 'băm nhỏ'], ['ot', 2, 'qua', true, 'băm nhỏ'], ['toi', 3, 'tep'], ['nuoc-mam', 2, 'thia-canh'], ['duong', 1, 'thia-canh'], ['nghe', 0.5, 'thia-ca-phe', false], ['dau-an', 2, 'thia-canh']],
    steps: [['Ướp gà', 'Ướp gà với một nửa sả, tỏi, nước mắm, đường và bột nghệ 15 phút.', 15], ['Phi sả', 'Phi thơm phần sả, ớt còn lại đến khi vàng.', 3], ['Xào gà', 'Cho gà vào xào lửa vừa đến khi chín và se mặt.', 12]],
  },
  {
    slug: 'canh-bi-do-thit-bam', name: 'Canh bí đỏ thịt băm',
    description: 'Canh ngọt thanh từ bí đỏ và thịt băm, hợp cho cả nhà.',
    meals: ['trua', 'toi'], types: ['mon-canh'], cuisines: ['mien-bac'], tags: ['cho-tre-em', 'healthy'], tastes: ['ngot', 'thanh-dam'], diets: ['it-dau-mo', 'khong-gluten'],
    servings: 3, prep: 10, cook: 15, difficulty: 'easy',
    ingredients: [['bi-do', 400, 'g', true, 'gọt vỏ, cắt miếng'], ['thit-lon-xay', 150, 'g'], ['hanh-la', 2, 'cay'], ['nuoc-mam', 1, 'thia-canh'], ['hat-nem', 1, 'thia-ca-phe', false]],
    steps: [['Xào thịt', 'Xào sơ thịt băm với chút hành cho săn.', 3], ['Nấu canh', 'Thêm 1 lít nước, đun sôi, cho bí đỏ vào nấu đến khi mềm.', 12], ['Nêm', 'Nêm nước mắm, hạt nêm, rắc hành lá.']],
  },
  {
    slug: 'tom-rim', name: 'Tôm rim mặn ngọt',
    description: 'Tôm rim nước mắm đường, vỏ đỏ au, vị mặn ngọt đưa cơm.',
    meals: ['trua', 'toi'], types: ['mon-kho'], cuisines: ['mien-trung'], tags: ['nhanh-gon'], tastes: ['ngot', 'man'], diets: ['khong-gluten'],
    servings: 2, prep: 10, cook: 12, difficulty: 'easy',
    ingredients: [['tom', 300, 'g', true, 'cắt râu, rút chỉ'], ['nuoc-mam', 2, 'thia-canh'], ['duong', 1, 'thia-canh'], ['hanh-tim', 2, 'cu'], ['dau-an', 1, 'thia-canh'], ['hat-tieu', 1, 'g', false], ['hanh-la', 1, 'cay', false]],
    steps: [['Phi hành', 'Phi thơm hành tím băm.', 2], ['Rim tôm', 'Cho tôm vào đảo đỏ, thêm nước mắm, đường, rim nhỏ lửa đến khi sệt.', 10], ['Hoàn thiện', 'Rắc tiêu và hành lá.']],
  },
  {
    slug: 'muc-xao-hanh-tay', name: 'Mực xào hành tây',
    description: 'Mực giòn ngọt xào cùng hành tây, ớt chuông nhiều màu.',
    meals: ['toi'], types: ['mon-xao'], cuisines: ['mien-trung'], tags: ['dai-tiec'], tastes: ['man'], diets: ['it-duong', 'khong-gluten'],
    servings: 3, prep: 15, cook: 8, difficulty: 'medium',
    ingredients: [['muc', 400, 'g', true, 'khứa vảy rồng'], ['hanh-tay', 1, 'cu', true, 'cắt múi'], ['ot-chuong', 1, 'qua', false, 'cắt miếng'], ['toi', 3, 'tep'], ['dau-hao', 1, 'thia-canh'], ['dau-an', 2, 'thia-canh']],
    steps: [['Chần mực', 'Chần mực qua nước sôi có gừng 30 giây cho săn.', 2], ['Xào', 'Phi tỏi, xào hành tây và ớt chuông, cho mực vào đảo nhanh, nêm dầu hào.', 5, 'Không xào lâu để mực không bị dai.']],
  },
  {
    slug: 'goi-cuon-tom-thit', name: 'Gỏi cuốn tôm thịt',
    description: 'Cuốn tôm, thịt, bún và rau sống trong bánh tráng, chấm tương hoặc nước mắm.',
    meals: ['chieu'], types: ['mon-goi', 'an-vat'], cuisines: ['mien-nam'], tags: ['healthy'], tastes: ['thanh-dam'], diets: ['it-dau-mo'],
    servings: 4, prep: 30, cook: 15, difficulty: 'medium',
    ingredients: [['banh-trang', 16, 'la'], ['tom', 300, 'g', true, 'luộc, bóc vỏ, chẻ đôi'], ['thit-ba-chi', 300, 'g', true, 'luộc, thái mỏng'], ['bun-tuoi', 300, 'g'], ['xa-lach', 1, 'bo'], ['rau-thom', 1, 'nam'], ['lac', 30, 'g', false, 'giã nhỏ làm nước chấm'], ['nuoc-mam', 2, 'thia-canh', false]],
    steps: [['Luộc tôm thịt', 'Luộc thịt khoảng 15 phút, luộc tôm 3 phút. Để nguội rồi thái.', 15], ['Cuốn', 'Nhúng bánh tráng qua nước, xếp rau, bún, thịt, tôm rồi cuộn chặt tay.', 20], ['Nước chấm', 'Pha nước mắm chua ngọt hoặc tương đậu, rắc lạc rang.', 5]],
  },
  {
    slug: 'khoai-tay-chien', name: 'Khoai tây chiên',
    description: 'Khoai tây chiên giòn ngoài mềm trong – món ăn vặt buổi chiều.',
    meals: ['chieu'], types: ['an-vat', 'mon-chien'], cuisines: ['au-my'], tags: ['cho-tre-em', 'nhanh-gon'], tastes: ['man', 'beo'], diets: ['chay', 'khong-gluten'],
    servings: 2, prep: 15, cook: 15, difficulty: 'easy',
    ingredients: [['khoai-tay', 3, 'cu', true, 'cắt thanh, ngâm nước muối'], ['dau-an', 500, 'ml'], ['muoi', 1, 'thia-ca-phe'], ['tuong-ca', 2, 'thia-canh', false]],
    steps: [['Sơ chế', 'Ngâm khoai trong nước muối 10 phút, để thật ráo.', 10], ['Chiên hai lần', 'Chiên lửa vừa 6 phút, vớt ra để nguội rồi chiên lại lửa lớn 3 phút cho giòn.', 10], ['Thưởng thức', 'Rắc muối, chấm tương cà.']],
  },
  {
    slug: 'mi-xao-bo', name: 'Mì xào bò',
    description: 'Mì trứng xào thịt bò mềm với cải ngọt và cà rốt.',
    meals: ['trua', 'toi'], types: ['mon-xao'], cuisines: ['chau-a'], tags: ['nhanh-gon'], tastes: ['man'], diets: [],
    servings: 2, prep: 15, cook: 10, difficulty: 'medium',
    ingredients: [['mi-trung', 200, 'g', true, 'trụng mềm'], ['thit-bo', 200, 'g', true, 'thái mỏng, ướp tỏi'], ['cai-ngot', 200, 'g', true, 'cắt khúc'], ['ca-rot', 0.5, 'cu', false, 'thái sợi'], ['toi', 3, 'tep'], ['dau-hao', 2, 'thia-canh'], ['dau-an', 2, 'thia-canh']],
    steps: [['Xào bò', 'Xào thịt bò lửa lớn đến khi tái, để riêng.', 3], ['Xào rau', 'Xào cải và cà rốt chín tới.', 3], ['Xào mì', 'Cho mì vào cùng dầu hào đảo đều, trút thịt bò vào, đảo nhanh rồi tắt bếp.', 4]],
  },
  {
    slug: 'bo-luc-lac', name: 'Bò lúc lắc',
    description: 'Thịt bò cắt khối xóc lửa lớn với hành tây, ớt chuông, ăn kèm xà lách.',
    meals: ['toi'], types: ['mon-xao'], cuisines: ['mien-nam'], tags: ['dai-tiec'], tastes: ['man', 'beo'], diets: ['it-duong'],
    servings: 2, prep: 20, cook: 10, difficulty: 'medium',
    ingredients: [['thit-bo', 400, 'g', true, 'cắt khối vuông'], ['hanh-tay', 1, 'cu'], ['ot-chuong', 1, 'qua', false], ['toi', 4, 'tep'], ['dau-hao', 1, 'thia-canh'], ['bo-lat', 20, 'g', false], ['xa-lach', 100, 'g', false], ['hat-tieu', 2, 'g']],
    steps: [['Ướp bò', 'Ướp thịt bò với tỏi, dầu hào, tiêu khoảng 15 phút.', 15], ['Xóc bò', 'Đun chảo thật nóng với bơ, cho bò vào xóc đều tay 3–4 phút.', 4], ['Hoàn thiện', 'Cho hành tây, ớt chuông vào đảo nhanh. Bày trên xà lách.', 3]],
  },
  {
    slug: 'ca-hoi-ap-chao', name: 'Cá hồi áp chảo',
    description: 'Cá hồi áp chảo da giòn, rưới bơ chanh, ăn kèm rau củ.',
    meals: ['toi'], types: ['mon-chien'], cuisines: ['au-my'], tags: ['healthy'], tastes: ['beo'], diets: ['it-duong', 'khong-gluten'],
    servings: 2, prep: 10, cook: 10, difficulty: 'easy',
    ingredients: [['ca-hoi', 2, 'mieng', true, 'thấm khô'], ['muoi', 0.5, 'thia-ca-phe'], ['hat-tieu', 1, 'g'], ['chanh', 0.5, 'qua'], ['bo-lat', 15, 'g', false], ['toi', 2, 'tep', false], ['dau-que', 100, 'g', false, 'luộc chín tới']],
    steps: [['Ướp', 'Rắc muối tiêu lên cá hồi.', 2], ['Áp chảo', 'Áp chảo mặt da xuống 4 phút đến khi giòn, lật lại 2 phút.', 6], ['Sốt bơ chanh', 'Cho bơ và tỏi vào chảo, rưới lên cá, vắt chanh.', 2]],
  },
  {
    slug: 'salad-dua-chuot-trung', name: 'Salad dưa chuột trứng',
    description: 'Salad mát lành từ dưa chuột, cà chua, trứng luộc và xà lách.',
    meals: ['chieu', 'toi'], types: ['mon-goi'], cuisines: ['au-my'], tags: ['healthy', 'nhanh-gon'], tastes: ['chua', 'thanh-dam'], diets: ['chay', 'it-dau-mo', 'khong-gluten'],
    servings: 2, prep: 15, cook: 10, difficulty: 'easy',
    ingredients: [['dua-chuot', 1, 'qua'], ['ca-chua', 1, 'qua'], ['trung-ga', 2, 'qua', true, 'luộc chín'], ['xa-lach', 100, 'g'], ['chanh', 0.5, 'qua'], ['mat-ong', 1, 'thia-canh', false], ['muoi', 0.25, 'thia-ca-phe']],
    steps: [['Luộc trứng', 'Luộc trứng 10 phút, ngâm nước lạnh rồi bóc vỏ, cắt múi.', 10], ['Trộn', 'Pha chanh, mật ong, muối; trộn đều với rau củ và trứng.', 5]],
  },
  {
    slug: 'chao-yen-mach-sua', name: 'Cháo yến mạch sữa',
    description: 'Yến mạch nấu sữa tươi, thêm mật ong – bữa sáng nhanh, no lâu.',
    meals: ['sang'], types: ['mon-com'], cuisines: ['au-my'], tags: ['healthy', 'nhanh-gon'], tastes: ['ngot'], diets: ['chay'],
    servings: 1, prep: 2, cook: 5, difficulty: 'easy',
    ingredients: [['yen-mach', 50, 'g'], ['sua-tuoi', 200, 'ml'], ['mat-ong', 1, 'thia-canh', false]],
    steps: [['Nấu', 'Đun sữa với yến mạch, khuấy đều 4–5 phút đến khi sánh.', 5], ['Thưởng thức', 'Rưới mật ong, có thể thêm trái cây.']],
  },
  {
    slug: 'banh-mi-chao', name: 'Bánh mì chảo',
    description: 'Chảo gang nóng với trứng ốp, pa-tê, xúc xích và bánh mì giòn.',
    meals: ['sang'], types: ['mon-chien'], cuisines: ['mien-nam'], tastes: ['beo', 'man'],
    servings: 1, prep: 5, cook: 8, difficulty: 'medium',
    ingredients: [['banh-mi', 1, 'chiec'], ['trung-ga', 2, 'qua'], ['thit-lon-xay', 80, 'g', true, 'viên nhỏ'], ['hanh-tay', 0.25, 'cu', false], ['tuong-ca', 1, 'thia-canh', false], ['bo-lat', 10, 'g', false], ['dau-an', 1, 'thia-canh']],
    steps: [['Áp thịt viên', 'Làm nóng chảo, áp thịt viên và hành tây chín vàng.', 4], ['Ốp trứng', 'Đập trứng vào chảo, đậy nắp 2 phút.', 3], ['Thưởng thức', 'Rưới tương cà, ăn kèm bánh mì nóng.']],
  },
  {
    slug: 'canh-ngao-nau-chua', name: 'Canh ngao nấu chua',
    description: 'Canh ngao ngọt nước với cà chua và dứa, chua thanh.',
    meals: ['trua', 'toi'], types: ['mon-canh'], cuisines: ['mien-bac'], tastes: ['chua'], diets: ['it-dau-mo', 'khong-gluten'],
    servings: 3, prep: 20, cook: 15, difficulty: 'medium',
    ingredients: [['ngao', 1, 'kg', true, 'ngâm nước vo gạo cho nhả cát'], ['ca-chua', 2, 'qua'], ['dua', 0.25, 'qua', false], ['hanh-la', 2, 'cay'], ['rau-thom', 1, 'nam', false], ['nuoc-mam', 1, 'thia-canh']],
    steps: [['Luộc ngao', 'Luộc ngao đến khi há miệng, gỡ thịt, lọc lấy nước.', 8], ['Nấu canh', 'Xào cà chua, đổ nước ngao vào đun sôi, thêm dứa.', 5], ['Hoàn thiện', 'Cho thịt ngao, nêm nước mắm, rắc hành và rau thơm.', 2]],
  },
  {
    slug: 'suon-xao-chua-ngot', name: 'Sườn xào chua ngọt',
    description: 'Sườn non chiên săn, sốt chua ngọt bóng đẹp.',
    meals: ['toi'], types: ['mon-xao'], cuisines: ['mien-bac'], tags: ['dai-tiec', 'cho-tre-em'], tastes: ['chua', 'ngot'], diets: [],
    servings: 3, prep: 15, cook: 30, difficulty: 'medium',
    ingredients: [['suon-lon', 500, 'g', true, 'chặt miếng, chần sơ'], ['tuong-ca', 3, 'thia-canh'], ['giam', 2, 'thia-canh'], ['duong', 2, 'thia-canh'], ['nuoc-mam', 1, 'thia-canh'], ['toi', 3, 'tep'], ['dau-an', 3, 'thia-canh'], ['hanh-la', 1, 'cay', false]],
    steps: [['Chiên sườn', 'Chiên sườn vàng đều các mặt.', 12], ['Pha sốt', 'Trộn tương cà, giấm, đường, nước mắm với ít nước.', 3], ['Rim sốt', 'Phi tỏi, cho sườn và sốt vào, rim lửa nhỏ đến khi sốt sệt, bóng.', 15]],
  },
  {
    slug: 'mien-xao-chay', name: 'Miến xào chay',
    description: 'Miến dong xào nấm hương, cà rốt, giá và đậu phụ – món chay thanh nhẹ.',
    meals: ['trua', 'toi'], types: ['mon-xao'], cuisines: ['mien-bac'], tags: ['healthy'], tastes: ['thanh-dam'], diets: ['chay', 'khong-gluten'],
    servings: 2, prep: 20, cook: 10, difficulty: 'easy',
    ingredients: [['mien', 150, 'g', true, 'ngâm mềm'], ['nam-huong', 30, 'g', true, 'ngâm nở, thái sợi'], ['ca-rot', 0.5, 'cu'], ['gia-do', 100, 'g', false], ['dau-phu', 1, 'mieng', false, 'chiên, thái sợi'], ['xi-dau', 2, 'thia-canh'], ['dau-an', 2, 'thia-canh']],
    steps: [['Xào rau nấm', 'Xào nấm hương và cà rốt chín tới.', 4], ['Xào miến', 'Cho miến, xì dầu vào đảo đều, thêm giá và đậu phụ.', 6]],
  },
  {
    slug: 'nom-dua-chuot-ca-rot', name: 'Nộm dưa chuột cà rốt',
    description: 'Nộm giòn mát chua ngọt, rắc lạc rang và rau thơm.',
    meals: ['chieu'], types: ['mon-goi'], cuisines: ['mien-bac'], tags: ['healthy'], tastes: ['chua', 'ngot'], diets: ['chay', 'it-dau-mo', 'khong-gluten'],
    servings: 3, prep: 20, cook: 0, difficulty: 'easy',
    ingredients: [['dua-chuot', 2, 'qua', true, 'thái sợi'], ['ca-rot', 1, 'cu', true, 'bào sợi'], ['giam', 2, 'thia-canh'], ['duong', 2, 'thia-canh'], ['xi-dau', 1, 'thia-canh'], ['lac', 40, 'g', false], ['rau-thom', 1, 'nam', false], ['ot', 1, 'qua', false]],
    steps: [['Bóp rau củ', 'Bóp dưa chuột, cà rốt với chút muối rồi vắt ráo.', 10], ['Trộn nộm', 'Pha giấm, đường, xì dầu; trộn đều với rau củ, rắc lạc và rau thơm.', 5]],
  },
  {
    slug: 'banh-xeo', name: 'Bánh xèo',
    description: 'Bánh xèo vỏ giòn vàng nghệ, nhân tôm thịt giá, cuốn rau sống.',
    meals: ['chieu', 'toi'], types: ['an-vat', 'mon-chien'], cuisines: ['mien-nam'], tags: ['dai-tiec'], tastes: ['beo', 'man'], diets: ['khong-gluten'],
    servings: 4, prep: 40, cook: 30, difficulty: 'hard',
    ingredients: [['bot-gao', 300, 'g'], ['nuoc-cot-dua', 200, 'ml'], ['nghe', 1, 'thia-ca-phe'], ['tom', 200, 'g'], ['thit-ba-chi', 200, 'g', true, 'thái mỏng'], ['gia-do', 200, 'g'], ['hanh-la', 3, 'cay'], ['xa-lach', 1, 'bo', false], ['nuoc-mam', 3, 'thia-canh', false]],
    steps: [['Pha bột', 'Trộn bột gạo, nước cốt dừa, bột nghệ, hành lá với nước, để bột nghỉ 30 phút.', 30, 'Bột loãng thì vỏ bánh mới giòn.'], ['Đổ bánh', 'Chảo thật nóng, xào sơ tôm thịt, đổ một lớp bột mỏng, thêm giá, đậy nắp 2 phút.', 4], ['Chiên giòn', 'Mở nắp, chiên đến khi đáy vàng giòn rồi gập đôi.', 3], ['Thưởng thức', 'Cuốn với xà lách, rau thơm, chấm nước mắm chua ngọt.']],
  },
  {
    slug: 'com-tam-suon-nuong', name: 'Cơm tấm sườn nướng',
    description: 'Cơm tấm với sườn nướng mật ong, trứng ốp và đồ chua.',
    meals: ['sang', 'trua'], types: ['mon-com'], cuisines: ['mien-nam'], tags: ['dai-tiec'], tastes: ['ngot', 'man'], diets: [],
    servings: 2, prep: 40, cook: 25, difficulty: 'medium',
    ingredients: [['suon-lon', 400, 'g', true, 'cốt lết, dần mỏng'], ['gao-te', 200, 'g'], ['mat-ong', 2, 'thia-canh'], ['nuoc-mam', 3, 'thia-canh'], ['toi', 4, 'tep'], ['hanh-tim', 2, 'cu'], ['trung-ga', 2, 'qua', false], ['dua-chuot', 1, 'qua', false]],
    steps: [['Ướp sườn', 'Ướp sườn với tỏi, hành, mật ong, nước mắm ít nhất 30 phút.', 30], ['Nấu cơm', 'Nấu cơm như thường lệ.', 25], ['Nướng sườn', 'Nướng sườn 200°C khoảng 20 phút, lật mặt giữa chừng.', 20], ['Trình bày', 'Xếp cơm, sườn, trứng ốp, dưa chuột; chan nước mắm pha.']],
  },
  // Món có dữ liệu chưa khai báo chế độ ăn (dietCodes = undefined) để kiểm thử “thiếu dữ liệu”
  {
    slug: 'bun-bo-xao', name: 'Bún bò xào',
    description: 'Bún trộn thịt bò xào sả, rau sống, lạc rang và nước mắm chua ngọt.',
    meals: ['trua'], types: ['mon-goi'], cuisines: ['mien-nam'], tastes: ['chua', 'ngot'],
    servings: 2, prep: 20, cook: 10, difficulty: 'easy',
    ingredients: [['bun-tuoi', 400, 'g'], ['thit-bo', 250, 'g', true, 'thái mỏng'], ['sa', 2, 'cay'], ['xa-lach', 100, 'g'], ['rau-thom', 1, 'nam'], ['lac', 30, 'g', false], ['nuoc-mam', 3, 'thia-canh'], ['duong', 2, 'thia-canh']],
    steps: [['Xào bò', 'Ướp bò với sả, xào nhanh lửa lớn.', 6], ['Trộn bún', 'Xếp bún, rau, thịt bò vào tô, rưới nước mắm pha, rắc lạc.', 4]],
  },
  // Bản nháp thiếu bước chế biến – dùng để kiểm thử UC55/UC63
  {
    slug: 'bun-rieu-cua', name: 'Bún riêu cua', status: 'draft',
    description: 'Bản nháp – chưa nhập các bước chế biến.',
    meals: ['sang', 'trua'], types: ['mon-nuoc'], cuisines: ['mien-bac'], tastes: ['chua'],
    servings: 4, prep: 40, cook: 40, difficulty: 'hard',
    ingredients: [['bun-tuoi', 1, 'kg'], ['ca-chua', 4, 'qua']],
    steps: [],
  },
  // Món đã ẩn – không được xuất hiện công khai
  {
    slug: 'lau-thai', name: 'Lẩu Thái', status: 'hidden',
    description: 'Đã ẩn để rà soát lại công thức.',
    meals: ['toi'], types: ['mon-nuoc'], cuisines: ['chau-a'], tastes: ['cay', 'chua'], diets: [],
    servings: 4, prep: 30, cook: 30, difficulty: 'medium',
    ingredients: [['tom', 300, 'g'], ['muc', 300, 'g'], ['sa', 3, 'cay'], ['ot', 3, 'qua']],
    steps: [['Nấu nước lẩu', 'Nấu nước dùng với sả, ớt, chanh.', 20], ['Nhúng', 'Nhúng hải sản và rau.', 10]],
  },
];

export const seedDishes: Dish[] = specs.map(build);
