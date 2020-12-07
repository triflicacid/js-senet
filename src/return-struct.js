/** Thing to return from functions */
class ReturnStruct {
  constructor(isError, msg) {
    this.error = isError;
    this.msg = msg;
  }
}

module.exports = ReturnStruct;