/* 検査用の学級：32人、6列×6行（2人組×3、班は4人）。 */
function makeInput(extra){
  var seats = [];
  // 列 1,2 | 4,5 | 7,8（3列目・6列目は通路）、行 2..7
  var cols = [1,2,4,5,7,8];
  for(var r = 2; r <= 7; r++) cols.forEach(function(c, ci){
    var pairCol = Math.floor(ci / 2);          // 0..2
    var rowBand = Math.floor((r - 2) / 2);     // 0..2
    seats.push({ r: r, c: c, group: rowBand * 3 + pairCol + 1 });
  });
  var students = [];
  for(var i = 1; i <= 32; i++) students.push({ id: i, name: 'じどう' + i, gender: i <= 16 ? '男' : '女', front: false, fixed: null, leader: false, care: false });
  var input = { seats: seats, students: students, conditions: [], history: [], settings: { frontRows: 2, historyDepth: 3, genderMode: '隣は男女' }, problems: [] };
  if(extra) extra(input);
  return input;
}
module.exports = { makeInput: makeInput };
