import type { Bi } from '../types';

/** Offline knowledge for demo mode: short kid-level answers, a try-at-home idea and two views. */
export interface KbTopic {
  re: RegExp;
  answer: Bi;
  tryIt: Bi;
  views: [Bi, Bi];
}

const b = (zh: string, en: string): Bi => ({ zh, en });

export const KB: KbTopic[] = [
  {
    re: /电脑|机器人|\bai\b|人工智能|程序|你是谁|你是人|你是真|真人|是不是人|你是机器|are you (a )?(human|real|person|robot)|who are you|robot|computer/i,
    answer: b('我是电脑里的程序，不是真人哦。我会用学过的东西陪你一起想问题。', "I'm a computer program, not a real person. I use what I learned to think with you."),
    tryIt: b('想一想：电脑会做什么？你会做什么电脑不会的事？', "Think: what can a computer do? What can you do that a computer can't?"),
    views: [b('有人认为电脑什么都知道。', 'Some people think computers know everything.'), b('也有人认为电脑也会出错，所以要一起查一查。', 'Others think computers make mistakes too, so we should check.')],
  },
  {
    re: /天.*蓝|蓝.*天|sky.*blue|blue.*sky|天空|sky/i,
    answer: b('阳光里藏着好多颜色，蓝色的光最爱在空气里跑来跑去，所以天看起来是蓝的。', 'Sunlight hides many colors. Blue light bounces around the air the most, so the sky looks blue.'),
    tryIt: b('傍晚和中午各看一次天空，比一比颜色一样吗？', 'Look at the sky at noon and at sunset. Are the colors the same?'),
    views: [b('有人认为天是蓝的是因为大海映上去的。', 'Some people think the sky is blue because it reflects the sea.'), b('也有人认为是空气把蓝色的光撒满了天空。', 'Others think the air scatters blue light all over the sky.')],
  },
  {
    re: /彩虹|rainbow/i,
    answer: b('彩虹是阳光穿过小水珠，被分成了好多颜色。', 'A rainbow is sunlight going through tiny water drops and splitting into colors.'),
    tryIt: b('晴天背对太阳，请大人帮你用喷壶喷水雾，找一找小彩虹！', 'On a sunny day, stand with the sun behind you and ask a grown-up to spray mist. Find a mini rainbow!'),
    views: [b('有人认为彩虹只有七种颜色。', 'Some people think a rainbow has only seven colors.'), b('也有人认为彩虹的颜色多得数不清，是慢慢变过去的。', 'Others think it has countless colors that slowly blend.')],
  },
  {
    re: /雨|rain/i,
    answer: b('云里的小水滴越聚越多、越来越重，就掉下来变成雨啦。', 'Tiny drops in clouds join together, get heavy, and fall as rain.'),
    tryIt: b('对着冰凉的镜子哈一口气，看看会不会出现小水珠？', 'Breathe on a cold mirror. Do little water drops appear?'),
    views: [b('有人认为云是棉花一样的东西。', 'Some people think clouds are made of something like cotton.'), b('也有人认为云其实是好多好多小水滴。', 'Others think clouds are really lots of tiny water drops.')],
  },
  {
    re: /月亮|moon/i,
    answer: b('月亮自己不会发光，它像镜子一样把太阳光反射给我们。', "The moon doesn't make its own light. It bounces sunlight to us like a mirror."),
    tryIt: b('连续几个晚上看月亮，画下它的样子，看看有什么变化。', 'Look at the moon for a few nights and draw it. How does it change?'),
    views: [b('有人认为月亮会变大变小。', 'Some people think the moon really grows and shrinks.'), b('也有人认为月亮一直是圆的，只是我们看到亮的部分不一样。', "Others think it's always round — we just see different lit parts.")],
  },
  {
    re: /太阳|sun\b|sunny/i,
    answer: b('太阳是一颗超级大、超级热的星星，它给我们光和温暖。', 'The sun is a super big, super hot star. It gives us light and warmth.'),
    tryIt: b('在太阳下放一块黑布和一块白布，过一会儿摸摸哪个更热。', 'Put a black cloth and a white cloth in the sun. Later, feel which is warmer.'),
    views: [b('有人认为太阳绕着地球转。', 'Some people think the sun goes around the Earth.'), b('也有人认为是地球绕着太阳转。', 'Others think the Earth goes around the sun.')],
  },
  {
    re: /星星|star/i,
    answer: b('星星是离我们特别远的太阳，太远了，所以看起来小小的。', "Stars are suns very far away. They're so far that they look tiny."),
    tryIt: b('晚上找一颗最亮的星星，明天同一时间再找找它还在不在。', 'Find the brightest star tonight. Is it in the same place tomorrow?'),
    views: [b('有人认为星星会眨眼睛是因为它在闪。', 'Some people think stars twinkle because they flicker.'), b('也有人认为是空气在动，让星光看起来在眨眼。', 'Others think moving air makes starlight look twinkly.')],
  },
  {
    re: /植物|花|草|树|叶|种子|plant|flower|tree|leaf|seed/i,
    answer: b('植物用根喝水，用叶子晒太阳，自己给自己做"饭"。', 'Plants drink with their roots and use leaves to catch sunlight to make their own food.'),
    tryIt: b('把一颗豆子放在湿纸巾上，每天看看它长出了什么。', 'Put a bean on a wet paper towel and check it every day. What grows?'),
    views: [b('有人认为植物晚上也在长大。', 'Some people think plants grow at night too.'), b('也有人认为植物只在白天长。', 'Others think plants only grow in the daytime.')],
  },
  {
    re: /猫|cat\b|cats/i,
    answer: b('猫咪呼噜噜，常常是因为它觉得舒服、放松。', 'Cats often purr when they feel cozy and relaxed.'),
    tryIt: b('观察一只猫：它什么时候摇尾巴？什么时候眯眼睛？', 'Watch a cat: when does it swish its tail? When does it squint?'),
    views: [b('有人认为猫摇尾巴是开心。', 'Some people think a cat wags its tail when happy.'), b('也有人认为猫摇尾巴可能是不耐烦。', 'Others think it may mean the cat is annoyed.')],
  },
  {
    re: /狗|dog/i,
    answer: b('小狗的鼻子特别灵，能闻到我们闻不到的味道。', 'Dogs have super noses that smell things we cannot.'),
    tryIt: b('请家人藏一块小饼干，看看小狗或你自己能不能闻出来在哪里。', 'Ask your family to hide a cookie. Can a dog — or you — sniff it out?'),
    views: [b('有人认为小狗只能看到黑白色。', 'Some people think dogs only see black and white.'), b('也有人认为小狗能看到一些颜色，比如蓝色和黄色。', 'Others think dogs can see some colors, like blue and yellow.')],
  },
  {
    re: /鸟|飞|bird|fly/i,
    answer: b('小鸟有轻轻的骨头和大大的翅膀，扇一扇就能把自己托起来。', 'Birds have light bones and big wings that push air to lift them up.'),
    tryIt: b('把一张纸折成纸飞机，再折一个不一样的，比比谁飞得远。', 'Fold two different paper planes and see which flies farther.'),
    views: [b('有人认为越大的翅膀飞得越快。', 'Some people think bigger wings fly faster.'), b('也有人认为小翅膀扇得快也能飞得很快。', 'Others think small fast-flapping wings can be fast too.')],
  },
  {
    re: /鱼|海|fish|sea|ocean/i,
    answer: b('鱼用鳃从水里"吸"氧气，所以能在水里呼吸。', 'Fish use gills to take oxygen from water, so they can breathe underwater.'),
    tryIt: b('看看鱼缸里的鱼，它的嘴和鳃是怎么一开一合的？', 'Watch a fish. How do its mouth and gills open and close?'),
    views: [b('有人认为鱼不睡觉。', "Some people think fish never sleep."), b('也有人认为鱼会睁着眼睛休息。', 'Others think fish rest with their eyes open.')],
  },
  {
    re: /恐龙|dinosaur/i,
    answer: b('恐龙很久很久以前生活在地球上，我们是从化石里认识它们的。', 'Dinosaurs lived a very long time ago. We learn about them from fossils.'),
    tryIt: b('用橡皮泥压一个树叶或玩具的印子，做一个你的"化石"。', 'Press a leaf or toy into play dough to make your own "fossil".'),
    views: [b('有人认为恐龙全都消失了。', 'Some people think all dinosaurs disappeared.'), b('也有人认为小鸟就是恐龙的后代。', 'Others think birds are the great-grandchildren of dinosaurs.')],
  },
  {
    re: /冰|雪|ice|snow|冷|cold/i,
    answer: b('水遇到很冷的时候会变硬，变成冰；暖和了又会变回水。', 'Water turns hard into ice when it is very cold, and melts back when warm.'),
    tryIt: b('把两块冰放在盘子里，一块撒点盐，看看哪块化得快。', 'Put two ice cubes on a plate, sprinkle salt on one. Which melts faster?'),
    views: [b('有人认为冰块放在毛巾里化得更快。', 'Some people think ice melts faster wrapped in a towel.'), b('也有人认为毛巾会让冰化得更慢。', 'Others think a towel makes it melt slower.')],
  },
  {
    re: /睡|梦|sleep|dream/i,
    answer: b('睡觉的时候，身体在休息，小脑袋也在整理今天学到的东西。', 'When you sleep, your body rests and your brain tidies up what you learned today.'),
    tryIt: b('明早起床后，试着把记得的梦画下来。', 'Tomorrow morning, try drawing a dream you remember.'),
    views: [b('有人认为每个人每天都会做梦。', 'Some people think everyone dreams every night.'), b('也有人认为有的人不做梦。', "Others think some people don't dream.")],
  },
];

export const GENERIC: KbTopic = {
  re: /.^/,
  answer: b('这个问题真有意思！小星也不太确定，我们一起查一查吧。', "What an interesting question! I'm not totally sure, so let's find out together."),
  tryIt: b('先仔细看一看、摸一摸、听一听，把你发现的告诉家人。', 'First look closely, touch and listen, then tell your family what you found.'),
  views: [b('有人认为答案就在书里。', 'Some people think the answer is in a book.'), b('也有人认为自己动手试一试才知道。', 'Others think you have to try it yourself to know.')],
};

export function findTopic(text: string): KbTopic {
  return KB.find((t) => t.re.test(text)) ?? GENERIC;
}
