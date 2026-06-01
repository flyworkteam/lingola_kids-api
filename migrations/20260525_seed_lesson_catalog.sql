INSERT INTO languages (code, name, sort_order, is_active) VALUES
('en','English',1,1),('de','German',2,1),('es','Spanish',3,1),('fr','French',4,1),
('hi','Hindi',5,1),('it','Italian',6,1),('ja','Japanese',7,1),('ko','Korean',8,1),
('pt','Portuguese',9,1),('ru','Russian',10,1),('tr','Turkish',11,1),('zh','Chinese',12,1)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO lessons (slug, title, asset_key, sort_order, is_active) VALUES
('alphabet','Alphabet','alphabet',1,1),('numbers','Numbers','numbers',2,1),('colors','Colors','colour',3,1),
('shapes','Shapes','shapes',4,1),('fruit','Fruit','fruits',5,1),('vegetables','Vegetables','vegetables',6,1),
('sports','Sports','sports',7,1),('fill-in','Fill in','fillIn',8,1)
ON DUPLICATE KEY UPDATE title = VALUES(title), asset_key = VALUES(asset_key), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'flash-cards', 'Flash Cards', 'flash_cards', CONCAT('/', slug, '/flash-cards'), 1, 1 FROM lessons WHERE slug IN ('alphabet','numbers','colors','shapes','fruit','vegetables','sports')
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'flip-cards', 'Flip Cards', 'flip_cards', CONCAT('/', slug, '/flip-cards'), 2, 1 FROM lessons WHERE slug IN ('alphabet','numbers','colors','shapes','fruit','vegetables','sports')
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'true-false', 'True False', 'true_false', CONCAT('/', slug, '/true-false'), 3, 1 FROM lessons WHERE slug IN ('alphabet','numbers','colors','shapes','fruit','vegetables','sports')
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'spelling', 'Spelling', 'spelling', CONCAT('/', slug, '/spelling'), 4, 1 FROM lessons WHERE slug IN ('alphabet','numbers','colors','shapes','fruit','vegetables','sports')
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'drawing', 'Drawing', 'drawing', CONCAT('/', slug, '/drawing'), 5, 1 FROM lessons WHERE slug IN ('alphabet','numbers','shapes')
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
SELECT id, 'puzzle', 'Fill In', 'fill_in', '/fill-in', 1, 1 FROM lessons WHERE slug = 'fill-in'
ON DUPLICATE KEY UPDATE title = VALUES(title), activity_type = VALUES(activity_type), route_name = VALUES(route_name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO lesson_items (lesson_id, item_key, label, asset_key, draw_asset_key, sort_order)
SELECT l.id, x.item_key, x.label, x.asset_key, x.draw_asset_key, x.sort_order
FROM lessons l JOIN (
  SELECT 'alphabet' lesson_slug,'a' item_key,'A' label,'letterA' asset_key,'drawA' draw_asset_key,1 sort_order UNION ALL
  SELECT 'alphabet','b','B','letterB','drawB',2 UNION ALL SELECT 'alphabet','c','C','letterC','drawC',3 UNION ALL
  SELECT 'alphabet','d','D','letterD','drawD',4 UNION ALL SELECT 'alphabet','e','E','letterE','drawE',5 UNION ALL
  SELECT 'alphabet','f','F','letterF','drawF',6 UNION ALL SELECT 'alphabet','g','G','letterG','drawG',7 UNION ALL
  SELECT 'alphabet','h','H','letterH','drawH',8 UNION ALL SELECT 'alphabet','i','I','letterI','drawI',9 UNION ALL
  SELECT 'alphabet','j','J','letterJ','drawJ',10 UNION ALL SELECT 'alphabet','k','K','letterK','drawK',11 UNION ALL
  SELECT 'alphabet','l','L','letterL','drawL',12 UNION ALL SELECT 'alphabet','m','M','letterM','drawM',13 UNION ALL
  SELECT 'alphabet','n','N','letterN','drawN',14 UNION ALL SELECT 'alphabet','o','O','letterO','drawO',15 UNION ALL
  SELECT 'alphabet','p','P','letterP','drawP',16 UNION ALL SELECT 'alphabet','q','Q','letterQ','drawQ',17 UNION ALL
  SELECT 'alphabet','r','R','letterR','drawR',18 UNION ALL SELECT 'alphabet','s','S','letterS','drawS',19 UNION ALL
  SELECT 'alphabet','t','T','letterT','drawT',20 UNION ALL SELECT 'alphabet','u','U','letterU','drawU',21 UNION ALL
  SELECT 'alphabet','v','V','letterV','drawV',22 UNION ALL SELECT 'alphabet','w','W','letterW','drawW',23 UNION ALL
  SELECT 'alphabet','x','X','letterX','drawX',24 UNION ALL SELECT 'alphabet','y','Y','letterY','drawY',25 UNION ALL
  SELECT 'alphabet','z','Z','letterZ','drawZ',26
) x ON l.slug = x.lesson_slug
ON DUPLICATE KEY UPDATE label = VALUES(label), asset_key = VALUES(asset_key), draw_asset_key = VALUES(draw_asset_key), sort_order = VALUES(sort_order);

INSERT INTO lesson_items (lesson_id, item_key, label, asset_key, draw_asset_key, sort_order)
SELECT l.id, x.item_key, x.label, x.asset_key, x.draw_asset_key, x.sort_order
FROM lessons l JOIN (
  SELECT 'numbers' lesson_slug,'1' item_key,'one' label,'number1' asset_key,'draw1' draw_asset_key,1 sort_order UNION ALL
  SELECT 'numbers','2','two','number2','draw2',2 UNION ALL SELECT 'numbers','3','three','number3','draw3',3 UNION ALL
  SELECT 'numbers','4','four','number4','draw4',4 UNION ALL SELECT 'numbers','5','five','number5','draw5',5 UNION ALL
  SELECT 'numbers','6','six','number6','draw6',6 UNION ALL SELECT 'numbers','7','seven','number7','draw7',7 UNION ALL
  SELECT 'numbers','8','eight','number8','draw8',8 UNION ALL SELECT 'numbers','9','nine','number9','draw9',9 UNION ALL
  SELECT 'numbers','0','zero','number0','draw0',10
) x ON l.slug = x.lesson_slug
ON DUPLICATE KEY UPDATE label = VALUES(label), asset_key = VALUES(asset_key), draw_asset_key = VALUES(draw_asset_key), sort_order = VALUES(sort_order);

INSERT INTO lesson_items (lesson_id, item_key, label, asset_key, sort_order)
SELECT l.id, x.item_key, x.label, x.asset_key, x.sort_order
FROM lessons l JOIN (
  SELECT 'colors' lesson_slug,'blue' item_key,'blue' label,'colorBlue' asset_key,1 sort_order UNION ALL
  SELECT 'colors','white','white','colorWhite',2 UNION ALL SELECT 'colors','orange','orange','colorOrange',3 UNION ALL
  SELECT 'colors','yellow','yellow','colorYellow',4 UNION ALL
  SELECT 'fruit','strawberry','strawberry','fruitStrawberry',1 UNION ALL SELECT 'fruit','lemon','lemon','fruitLemon',2 UNION ALL
  SELECT 'fruit','pineapple','pineapple','fruitPineapple',3 UNION ALL SELECT 'fruit','banana','banana','fruitBanana',4 UNION ALL
  SELECT 'fruit','orange','orange','fruitOrange',5 UNION ALL SELECT 'fruit','avocado','avocado','fruitAvocado',6 UNION ALL
  SELECT 'fruit','pear','pear','fruitPear',7 UNION ALL SELECT 'fruit','cherry','cherry','fruitCherry',8 UNION ALL
  SELECT 'fruit','grapes','grapes','fruitGrapes',9 UNION ALL SELECT 'fruit','watermelon','watermelon','fruitWatermelon',10 UNION ALL
  SELECT 'fruit','apple','apple','fruitApple',11 UNION ALL SELECT 'fruit','blueberry','blueberry','fruitBlueberry',12 UNION ALL
  SELECT 'fruit','kiwi','kiwi','fruitKiwi',13 UNION ALL SELECT 'fruit','dragonfruit','dragonfruit','fruitDragonfruit',14 UNION ALL
  SELECT 'fruit','lime','lime','fruitLime',15 UNION ALL
  SELECT 'vegetables','tomato','tomato','vegetableTomato',1 UNION ALL SELECT 'vegetables','corn','corn','vegetableCorn',2 UNION ALL
  SELECT 'vegetables','potato','potato','vegetablePotato',3 UNION ALL SELECT 'vegetables','onion','onion','vegetableOnion',4 UNION ALL
  SELECT 'vegetables','eggplant','eggplant','vegetableEggplant',5 UNION ALL SELECT 'vegetables','pepper','pepper','vegetableBellPepper',6 UNION ALL
  SELECT 'vegetables','mushroom','mushroom','vegetableMushroom',7 UNION ALL SELECT 'vegetables','cucumber','cucumber','vegetableCucumber',8 UNION ALL
  SELECT 'vegetables','lemon','lemon','vegetableChiliPepper',9 UNION ALL SELECT 'vegetables','pumpkin','pumpkin','vegetablePumpkin',10 UNION ALL
  SELECT 'vegetables','broccoli','broccoli','vegetableBroccoli',11 UNION ALL SELECT 'vegetables','cabbage','cabbage','vegetableCabbage',12 UNION ALL
  SELECT 'sports','basketball','basketball','sportsBasketball',1 UNION ALL SELECT 'sports','football','football','sportsFootball',2 UNION ALL
  SELECT 'sports','volleyball','volleyball','sportsVolleyball',3 UNION ALL SELECT 'sports','tennis','tennis','sportsTennis',4 UNION ALL
  SELECT 'sports','table-tennis','table tennis','sportsTableTennis',5 UNION ALL SELECT 'sports','golf','golf','sportsBilliards',6 UNION ALL
  SELECT 'sports','dumbbell','dumbbell','sportsDumbbell',7 UNION ALL SELECT 'sports','badminton','badminton','sportsBadminton',8 UNION ALL
  SELECT 'sports','baseball','baseball','sportsBaseball',9 UNION ALL SELECT 'sports','boxing','boxing','sportsBoxing',10 UNION ALL
  SELECT 'sports','cycling','cycling','sportsCycling',11 UNION ALL SELECT 'sports','archery','archery','sportsArchery',12 UNION ALL
  SELECT 'fill-in','lion','lion','animalsLion',1 UNION ALL SELECT 'fill-in','bear','bear','animalsBear',2 UNION ALL
  SELECT 'fill-in','camel','camel','animalsCamel',3 UNION ALL SELECT 'fill-in','deer','deer','animalsDeer',4 UNION ALL
  SELECT 'fill-in','elephant','elephant','animalsElephant',5 UNION ALL SELECT 'fill-in','fox','fox','animalsFox',6 UNION ALL
  SELECT 'fill-in','giraffe','giraffe','animalsGiraffe',7 UNION ALL SELECT 'fill-in','gorilla','gorilla','animalsGorilla',8 UNION ALL
  SELECT 'fill-in','hippo','hippo','animalsHippo',9 UNION ALL SELECT 'fill-in','kangaroo','kangaroo','animalsKangaroo',10 UNION ALL
  SELECT 'fill-in','koala','koala','animalsKoala',11 UNION ALL SELECT 'fill-in','monkey','monkey','animalsMonkey',12 UNION ALL
  SELECT 'fill-in','panda','panda','animalsPanda',13 UNION ALL SELECT 'fill-in','penguin','penguin','animalsPenguin',14 UNION ALL
  SELECT 'fill-in','tiger','tiger','animalsTiger',15 UNION ALL SELECT 'fill-in','zebra','zebra','animalsZebra',16
) x ON l.slug = x.lesson_slug
ON DUPLICATE KEY UPDATE label = VALUES(label), asset_key = VALUES(asset_key), sort_order = VALUES(sort_order);

INSERT INTO lesson_items (lesson_id, item_key, label, asset_key, draw_asset_key, sort_order)
SELECT l.id, x.item_key, x.label, x.asset_key, x.draw_asset_key, x.sort_order
FROM lessons l JOIN (
  SELECT 'shapes' lesson_slug,'square' item_key,'square' label,'shapesSquare' asset_key,'drawSquare' draw_asset_key,1 sort_order UNION ALL
  SELECT 'shapes','circle','circle','shapesCircle','drawCircle',2 UNION ALL SELECT 'shapes','triangle','triangle','shapesTriangle','drawTriangle',3 UNION ALL
  SELECT 'shapes','star','star','shapesStar','drawStar',4 UNION ALL SELECT 'shapes','rectangle','rectangle','shapesRectangle','drawRectangle',5 UNION ALL
  SELECT 'shapes','elips','elips','shapesOval','drawOval',6 UNION ALL SELECT 'shapes','hexagon','hexagon','shapesHexagon','drawHexagon',7 UNION ALL
  SELECT 'shapes','diamond','diamond','shapesDiamond','drawDiamond',8 UNION ALL SELECT 'shapes','rounded-rectangle','rounded rectangle','shapesRoundedRectangle','drawRoundedRectangle',9 UNION ALL
  SELECT 'shapes','semicircle','semicircle','shapesSemicircle','drawSemicircle',10 UNION ALL SELECT 'shapes','trapezoid','trapezoid','shapesTrapezoid','drawTrapezoid',11
) x ON l.slug = x.lesson_slug
ON DUPLICATE KEY UPDATE label = VALUES(label), asset_key = VALUES(asset_key), draw_asset_key = VALUES(draw_asset_key), sort_order = VALUES(sort_order);
